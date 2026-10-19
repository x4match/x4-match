import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { parseMoneyInput } from '@/lib/currency';
import { isPlayer } from '@/lib/roles';
import { pickShopProductPhoto, showShopProductPhotoOptions } from '@/lib/shop/shop-product-photo';
import {
  LISTING_CATEGORIES,
  LISTING_CONDITIONS,
  MARKETPLACE_QUERY_KEY,
  MAX_LISTING_PHOTOS,
  createListing,
  fetchListing,
  listingQueryKey,
  removeListingPhoto,
  updateListing,
  uploadListingPhoto,
  type ListingCategory,
  type ListingCondition,
  type PlayerListingRow,
} from '@/lib/shop/player-marketplace';
import { fontFamily } from '@/theme/tokens';
import { EmptyState, InputField, MoneyInputField, PrimaryButton, Screen, StackHeader } from '@/components/x4match';
import { ShopChip, SHOP_LIME, SHOP_MUTED } from '@/components/shop/marketplace';

const PHOTO_SIZE = 92;

function errorMessage(err: any, fallback: string): string {
  const message = err?.response?.data?.message;
  if (Array.isArray(message)) return message.join('\n');
  return typeof message === 'string' ? message : fallback;
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

export default function SellListingScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = !!id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const canSell = !!user && isPlayer(user.role);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<ListingCategory | null>(null);
  const [condition, setCondition] = useState<ListingCondition | null>(null);
  const [city, setCity] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]);
  const [remotePhotos, setRemotePhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const existingQuery = useQuery({
    queryKey: listingQueryKey(id ?? ''),
    queryFn: () => fetchListing(id!),
    enabled: isEditing,
  });

  useEffect(() => {
    const listing = existingQuery.data;
    if (!listing) return;
    setTitle(listing.title);
    setDescription(listing.description ?? '');
    setPrice(String(Math.round(Number(listing.price) || 0)));
    setCategory(listing.category);
    setCondition(listing.condition);
    setCity(listing.city ?? '');
    setRemotePhotos(listing.photo_urls ?? []);
  }, [existingQuery.data]);

  const photoCount = isEditing ? remotePhotos.length : pendingPhotos.length;
  const canAddPhoto = photoCount < MAX_LISTING_PHOTOS;

  const syncListing = (updated: PlayerListingRow) => {
    queryClient.setQueryData(listingQueryKey(updated.id), updated);
    queryClient.invalidateQueries({ queryKey: MARKETPLACE_QUERY_KEY });
  };

  const addPhoto = () => {
    if (!canAddPhoto) return;
    showShopProductPhotoOptions({
      hasPhoto: false,
      onPick: async (source) => {
        const uri = await pickShopProductPhoto(source);
        if (!uri) return;
        if (!isEditing) {
          setPendingPhotos((prev) => [...prev, uri].slice(0, MAX_LISTING_PHOTOS));
          return;
        }
        setPhotoBusy(true);
        try {
          const updated = await uploadListingPhoto(id!, uri);
          setRemotePhotos(updated.photo_urls ?? []);
          syncListing(updated);
        } catch (err) {
          Alert.alert('Error', errorMessage(err, 'No se pudo subir la foto'));
        } finally {
          setPhotoBusy(false);
        }
      },
    });
  };

  const removePhoto = (uri: string) => {
    if (!isEditing) {
      setPendingPhotos((prev) => prev.filter((p) => p !== uri));
      return;
    }
    Alert.alert('Quitar foto', '¿Querés quitar esta foto de la publicación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          setPhotoBusy(true);
          try {
            const updated = await removeListingPhoto(id!, uri);
            setRemotePhotos(updated.photo_urls ?? []);
            syncListing(updated);
          } catch (err) {
            Alert.alert('Error', errorMessage(err, 'No se pudo quitar la foto'));
          } finally {
            setPhotoBusy(false);
          }
        },
      },
    ]);
  };

  const submit = async () => {
    const amount = parseMoneyInput(price);
    if (title.trim().length < 3) return Alert.alert('Falta el título', 'Escribí qué estás vendiendo.');
    if (!category) return Alert.alert('Falta la categoría', 'Elegí una categoría.');
    if (!condition) return Alert.alert('Falta el estado', 'Indicá si es nuevo o usado.');
    if (amount <= 0) return Alert.alert('Falta el precio', 'Ingresá un precio mayor a 0.');
    if (!isEditing && pendingPhotos.length === 0) {
      return Alert.alert('Agregá una foto', 'Las publicaciones con fotos se venden mucho más rápido.');
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      price: amount,
      category,
      condition,
      city: city.trim(),
    };

    setSaving(true);
    try {
      if (isEditing) {
        const updated = await updateListing(id!, payload);
        syncListing(updated);
        router.back();
        return;
      }

      let listing = await createListing(payload);
      let failedUploads = 0;
      for (const uri of pendingPhotos) {
        try {
          listing = await uploadListingPhoto(listing.id, uri);
        } catch {
          failedUploads += 1;
        }
      }
      syncListing(listing);
      queryClient.invalidateQueries({ queryKey: MARKETPLACE_QUERY_KEY });
      router.replace({ pathname: '/marketplace/[id]', params: { id: listing.id } } as any);
      if (failedUploads > 0) {
        Alert.alert(
          'Publicado',
          `No pudimos subir ${failedUploads} foto${failedUploads === 1 ? '' : 's'}. Podés agregarlas editando la publicación.`,
        );
      }
    } catch (err) {
      Alert.alert('Error', errorMessage(err, 'No se pudo guardar la publicación'));
    } finally {
      setSaving(false);
    }
  };

  if (!canSell) {
    return (
      <Screen>
        <StackHeader title="Vender" />
        <EmptyState
          icon={<Ionicons name="lock-closed-outline" size={32} color={SHOP_MUTED} />}
          title="Solo para jugadores"
          description="Únicamente las cuentas de jugador pueden publicar productos en el marketplace."
        />
      </Screen>
    );
  }

  if (isEditing && existingQuery.isLoading) {
    return (
      <Screen>
        <StackHeader title="Editar publicación" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={SHOP_LIME} />
        </View>
      </Screen>
    );
  }

  const photos = isEditing ? remotePhotos : pendingPhotos;

  return (
    <Screen>
      <StackHeader title={isEditing ? 'Editar publicación' : 'Vender un producto'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <FieldLabel>{`Fotos (${photos.length}/${MAX_LISTING_PHOTOS})`}</FieldLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -16, marginBottom: 6 }}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          >
            {photos.map((uri, i) => (
              <View key={uri}>
                <Image source={{ uri }} style={styles.photo} />
                {i === 0 ? (
                  <View style={styles.coverBadge}>
                    <Text style={styles.coverText}>PORTADA</Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => removePhoto(uri)}
                  disabled={photoBusy}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Quitar foto"
                  style={styles.removePhoto}
                >
                  <Ionicons name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
            {canAddPhoto ? (
              <Pressable
                onPress={addPhoto}
                disabled={photoBusy}
                accessibilityRole="button"
                accessibilityLabel="Agregar foto"
                style={[styles.photo, styles.addPhoto]}
              >
                {photoBusy ? (
                  <ActivityIndicator color={SHOP_LIME} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={24} color={SHOP_LIME} />
                    <Text style={styles.addPhotoText}>Agregar</Text>
                  </>
                )}
              </Pressable>
            ) : null}
          </ScrollView>
          <Text style={styles.hint}>La primera foto es la portada. Mostrá el producto de frente y sus detalles.</Text>

          <View style={{ height: 18 }} />
          <InputField
            label="Título"
            value={title}
            onChangeText={setTitle}
            placeholder="Ej: Paleta Bullpadel Vertex 03 2023"
            maxLength={80}
          />

          <FieldLabel>Categoría</FieldLabel>
          <View style={styles.wrap}>
            {LISTING_CATEGORIES.map((c) => (
              <ShopChip
                key={c.value}
                label={c.label}
                active={category === c.value}
                onPress={() => setCategory(c.value)}
                leading={<Ionicons name={c.icon} size={14} color={category === c.value ? '#000' : SHOP_LIME} />}
              />
            ))}
          </View>

          <FieldLabel>Estado</FieldLabel>
          <View style={{ gap: 8, marginBottom: 18 }}>
            {LISTING_CONDITIONS.map((c) => {
              const active = condition === c.value;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => setCondition(c.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={[styles.conditionRow, active ? styles.conditionRowActive : null]}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={active ? SHOP_LIME : SHOP_MUTED}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.conditionLabel}>{c.label}</Text>
                    <Text style={styles.hint}>{c.hint}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <MoneyInputField label="Precio" value={price} onChangeText={setPrice} placeholder="150.000" />
          <InputField
            label="Zona (opcional)"
            value={city}
            onChangeText={setCity}
            placeholder="Ej: Palermo, CABA"
            maxLength={80}
          />
          <InputField
            label="Descripción (opcional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Contá el estado, el tiempo de uso, talle, si incluye funda, etc."
            multiline
            maxLength={1500}
            style={{ minHeight: 110, textAlignVertical: 'top' }}
          />

          <PrimaryButton
            label={isEditing ? 'Guardar cambios' : 'Publicar'}
            fullWidth
            loading={saving}
            disabled={saving || photoBusy}
            onPress={submit}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: SHOP_MUTED,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: fontFamily.regular,
  },
  hint: {
    color: SHOP_MUTED,
    fontSize: 12,
    marginTop: 2,
    fontFamily: fontFamily.regular,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 14,
    backgroundColor: '#0B0B0F',
  },
  addPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(215,255,0,0.5)',
  },
  addPhotoText: {
    color: SHOP_LIME,
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBadge: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    backgroundColor: SHOP_LIME,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coverText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: fontFamily.bold,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  conditionRowActive: {
    borderColor: 'rgba(215,255,0,0.55)',
    backgroundColor: 'rgba(215,255,0,0.06)',
  },
  conditionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: fontFamily.bold,
  },
});
