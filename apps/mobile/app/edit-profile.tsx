import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { requestPlayerCoordinates } from '@/lib/geolocation';
import { pickAndUploadProfilePhoto, showProfilePhotoOptions } from '@/lib/profile-photo';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, InputField, PrimaryButton, Avatar, SectionHeader, ProfilePhotoViewer } from '@/components/padely';

const GENDER_OPTIONS = ['Masculino', 'Femenino', 'Otro'] as const;

function profileErrorMessage(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data
    ?.message;
  if (Array.isArray(message)) return message.join('\n');
  if (typeof message === 'string') return message;
  return 'No se pudo actualizar el perfil';
}

export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [preferences, setPreferences] = useState({
    preferredHand: '',
    courtPosition: '',
    matchType: '',
    preferredPlayTime: '',
  });

  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, []),
  );

  const handlePickPhoto = () => {
    showProfilePhotoOptions({
      hasPhoto: !!(photoUri || user?.photo),
      onView: photoUri || user?.photo ? () => setShowPhotoViewer(true) : undefined,
      onPick: async (source) => {
        setUploadingPhoto(true);
        try {
          const photoUrl = await pickAndUploadProfilePhoto(source);
          if (!photoUrl) return;
          setPhotoUri(photoUrl);
          await updateUser({ photo: photoUrl });
          await queryClient.invalidateQueries({ queryKey: ['profile-me'] });
          Alert.alert('Listo', 'Foto actualizada');
        } finally {
          setUploadingPhoto(false);
        }
      },
    });
  };

  const loadProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      const data = response.data;
      setName(data.name || '');
      setNickname(data.nickname || user?.nickname || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
      setGender(data.gender || '');
      setBirthDate(data.birthDate ? new Date(data.birthDate) : null);
      setDescription(data.description || '');
      setLocation(data.location || '');
      setPhotoUri(data.photo || null);
      setPreferences({
        preferredHand: data.preferences?.preferredHand || '',
        courtPosition: data.preferences?.courtPosition || '',
        matchType: data.preferences?.matchType || '',
        preferredPlayTime: data.preferences?.preferredPlayTime || '',
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateForDisplay = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
  };

  const formatDateForAPI = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  };

  const onDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) setBirthDate(selectedDate);
  };

  const handleRequestLocation = async () => {
    setLoadingLocation(true);
    try {
      const coords = await requestPlayerCoordinates({ withLabel: true, showAlerts: true });
      if (!coords) return;
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);
      if (coords.label) setLocation(coords.label);
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }
    const normalizedNickname = nickname.trim().toLowerCase();
    if (!normalizedNickname) {
      Alert.alert('Error', 'Elegí un nombre de usuario');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(normalizedNickname)) {
      Alert.alert('Error', 'El usuario debe tener entre 3 y 20 caracteres (letras, números o _)');
      return;
    }
    setSaving(true);
    try {
      const profileData: Record<string, unknown> = {
        name: name.trim(),
        nickname: normalizedNickname,
        phone: phone.trim() || null,
        gender: gender || null,
        description: description.trim() || null,
        location: location.trim() || null,
      };
      if (birthDate) profileData.birthDate = formatDateForAPI(birthDate);
      if (latitude != null && longitude != null) {
        profileData.latitude = latitude;
        profileData.longitude = longitude;
      }
      const response = await api.patch('/users/profile', profileData);
      await updateUser({
        name: response.data.name,
        nickname: response.data.nickname,
        phone: response.data.phone,
        gender: response.data.gender,
        birthDate: response.data.birthDate,
        description: response.data.description,
        location: response.data.location,
        photo: response.data.photo,
      });
      await queryClient.invalidateQueries({ queryKey: ['profile-me'] });
      Alert.alert('Listo', 'Perfil actualizado correctamente');
      router.back();
    } catch (error) {
      Alert.alert('Error', profileErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const preferencesSubtitle = [preferences.preferredHand, preferences.courtPosition, preferences.matchType]
    .filter(Boolean)
    .join(', ');

  const saveButton = (
    <TouchableOpacity onPress={handleSave} disabled={saving || loading} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      {saving ? (
        <ActivityIndicator size="small" color={ui.colors.primary} />
      ) : (
        <Text style={{ color: ui.colors.primary, fontWeight: '700', fontSize: 15 }}>Guardar</Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <Screen>
        <StackHeader title="Editar perfil" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={ui.colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StackHeader title="Editar perfil" rightAction={saveButton} />
      <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ alignItems: 'center', marginBottom: ui.spacing.lg }}>
          <TouchableOpacity
            onPress={handlePickPhoto}
            disabled={uploadingPhoto}
            activeOpacity={0.9}
          >
            <View style={{ position: 'relative' }}>
              <Avatar name={name || 'U'} photo={photoUri || user?.photo} size="xl" />
              {uploadingPhoto && (
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickPhoto} disabled={uploadingPhoto} style={{ marginTop: 12 }}>
            <Text style={{ color: ui.colors.primary, fontWeight: '600', fontSize: 14 }}>
              {uploadingPhoto ? 'Subiendo...' : 'Cambiar foto de perfil'}
            </Text>
          </TouchableOpacity>
          {photoUri || user?.photo ? (
            <Text style={{ color: ui.colors.textMuted, fontSize: 11, marginTop: 8 }}>
              Tocá la foto para verla en grande
            </Text>
          ) : null}
        </View>

        <SectionHeader title="Información personal" dark />
        <AppCard>
          <InputField label="Nombre y apellidos" value={name} onChangeText={setName} placeholder="Tu nombre completo" />
          <InputField
            label="Nombre de usuario"
            value={nickname}
            onChangeText={(text) =>
              setNickname(text.replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_]/g, ''))
            }
            placeholder="ej: franconawel"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: -4, marginBottom: ui.spacing.md }}>
            Así te van a encontrar otros jugadores (@{nickname.trim() || 'tuusuario'}).
          </Text>
          <View style={{ marginBottom: ui.spacing.md }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.textSecondary, marginBottom: 6 }}>Email</Text>
            <Text style={{ fontSize: 15, color: ui.colors.textMuted }}>{email}</Text>
          </View>
          <InputField label="Teléfono" value={phone} onChangeText={setPhone} placeholder="+54 11 ..." keyboardType="phone-pad" />

          <TouchableOpacity onPress={() => setShowGenderPicker(!showGenderPicker)} style={{ marginBottom: ui.spacing.md }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.textSecondary, marginBottom: 6 }}>Género</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, color: gender ? ui.colors.textPrimary : ui.colors.textMuted }}>
                {gender || 'Seleccionar'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={ui.colors.textMuted} />
            </View>
          </TouchableOpacity>
          {showGenderPicker && (
            <View style={{ marginBottom: ui.spacing.md, borderRadius: ui.radius.md, overflow: 'hidden', borderWidth: 1, borderColor: ui.colors.border }}>
              {GENDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => {
                    setGender(option);
                    setShowGenderPicker(false);
                  }}
                  style={{
                    padding: 14,
                    backgroundColor: gender === option ? 'rgba(20,184,166,0.1)' : ui.colors.card,
                    borderBottomWidth: 1,
                    borderBottomColor: ui.colors.border,
                  }}
                >
                  <Text style={{ color: gender === option ? ui.colors.primary : ui.colors.textPrimary, fontWeight: gender === option ? '700' : '400' }}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={{ marginBottom: ui.spacing.md }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.textSecondary, marginBottom: 6 }}>Fecha de nacimiento</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 15, color: birthDate ? ui.colors.textPrimary : ui.colors.textMuted }}>
                {birthDate ? formatDateForDisplay(birthDate) : 'DD/MM/AAAA'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={ui.colors.textMuted} />
            </View>
          </TouchableOpacity>
          {showDatePicker && (
            <View style={{ marginBottom: ui.spacing.md }}>
              <DateTimePicker
                value={birthDate || new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                minimumDate={new Date(1930, 0, 1)}
                onChange={onDateChange}
                locale="es"
              />
              {Platform.OS === 'ios' && (
                <PrimaryButton label="Confirmar fecha" onPress={() => setShowDatePicker(false)} fullWidth size="sm" style={{ marginTop: 8 }} />
              )}
            </View>
          )}

          <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.textSecondary, marginBottom: 6 }}>Descripción</Text>
          <TextInput
            value={description}
            onChangeText={(text) => text.length <= 160 && setDescription(text)}
            placeholder="Escribí algo sobre vos..."
            placeholderTextColor={ui.colors.textMuted}
            multiline
            numberOfLines={3}
            style={{
              minHeight: 80,
              textAlignVertical: 'top',
              backgroundColor: ui.colors.cardMuted,
              borderRadius: ui.radius.md,
              padding: 12,
              fontSize: 15,
              color: ui.colors.textPrimary,
              marginBottom: 4,
            }}
          />
          <Text style={{ fontSize: 11, color: ui.colors.textMuted, marginBottom: ui.spacing.md }}>
            {160 - description.length} caracteres restantes
          </Text>

          <InputField
            label="¿Dónde jugás?"
            value={location}
            onChangeText={setLocation}
            placeholder="Ciudad, zona..."
            rightIcon={
              loadingLocation ? (
                <ActivityIndicator size="small" color={ui.colors.primary} />
              ) : (
                <TouchableOpacity onPress={handleRequestLocation}>
                  <Ionicons name="navigate-outline" size={22} color={ui.colors.primary} />
                </TouchableOpacity>
              )
            }
          />
          <TouchableOpacity onPress={handleRequestLocation} disabled={loadingLocation} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="locate-outline" size={16} color={ui.colors.primary} />
            <Text style={{ color: ui.colors.primary, fontSize: 13, marginLeft: 6 }}>Usar mi ubicación actual</Text>
          </TouchableOpacity>
        </AppCard>

        <SectionHeader title="Preferencias de jugador" dark />
        <TouchableOpacity onPress={() => router.push('/edit-preferences' as any)} activeOpacity={0.85}>
          <AppCard>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(20,184,166,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="tennisball" size={22} color={ui.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>Editar preferencias</Text>
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }} numberOfLines={1}>
                  {preferencesSubtitle || 'Mano, posición, tipo de partido...'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={ui.colors.textMuted} />
            </View>
          </AppCard>
        </TouchableOpacity>

        <SectionHeader title="Seguridad" dark />
        <TouchableOpacity onPress={() => router.push('/change-password' as any)} activeOpacity={0.85}>
          <AppCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>Contraseña</Text>
                <Text style={{ fontSize: 16, color: ui.colors.textPrimary, letterSpacing: 2, marginTop: 4 }}>••••••••••</Text>
              </View>
              <Ionicons name="create-outline" size={22} color={ui.colors.textMuted} />
            </View>
          </AppCard>
        </TouchableOpacity>

        <View style={{ marginTop: ui.spacing.lg }}>
          <PrimaryButton label="Guardar cambios" onPress={handleSave} loading={saving} fullWidth size="lg" />
        </View>
      </ScrollView>

      <ProfilePhotoViewer
        visible={showPhotoViewer}
        photo={photoUri || user?.photo}
        name={name || user?.name || 'Perfil'}
        onClose={() => setShowPhotoViewer(false)}
      />
    </Screen>
  );
}
