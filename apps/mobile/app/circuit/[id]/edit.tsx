import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { safeMapCircuit } from '@/lib/mappers';
import {
  NO_CIRCUIT_ACCESS,
  apiErrorMessage,
  defaultCircuitTitle,
  hasCircuitPermission,
  pickAndUploadCircuitLogo,
} from '@/lib/circuits/staff';
import { ui } from '@/theme/tokens';
import {
  AppCard,
  EmptyState,
  InputField,
  PrimaryButton,
  Screen,
  StackHeader,
  withCircuitsEnabled,
} from '@/components/x4match';

type FormState = {
  name: string;
  shortName: string;
  season: string;
  description: string;
  city: string;
  contactPhone: string;
  contactEmail: string;
  instagram: string;
  website: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  shortName: '',
  season: '',
  description: '',
  city: '',
  contactPhone: '',
  contactEmail: '',
  instagram: '',
  website: '',
};

export default withCircuitsEnabled(EditCircuitScreen);

function EditCircuitScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const circuitId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['circuit', circuitId],
    queryFn: async () => (await api.get(`/circuits/${circuitId}`)).data,
    enabled: !!circuitId,
  });
  const circuit = useMemo(() => safeMapCircuit(data), [data]);
  const canEdit = hasCircuitPermission(circuit?.viewer ?? NO_CIRCUIT_ACCESS, 'circuit.edit');

  useEffect(() => {
    if (!circuit) return;
    setForm({
      name: circuit.name ?? '',
      shortName: circuit.shortName ?? '',
      season: circuit.season ?? '',
      description: circuit.description ?? '',
      city: circuit.city ?? '',
      contactPhone: circuit.contactPhone ?? '',
      contactEmail: circuit.contactEmail ?? '',
      instagram: circuit.instagram ?? '',
      website: circuit.website ?? '',
    });
    // Solo al cargar: no pisar lo que el usuario está escribiendo en refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuit?.id]);

  const set = (key: keyof FormState) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['circuit', circuitId] });
    queryClient.invalidateQueries({ queryKey: ['circuits-tab'] });
    queryClient.invalidateQueries({ queryKey: ['organizer-circuits-mine'] });
    queryClient.invalidateQueries({ queryKey: ['circuit-roles-user'] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('El nombre es obligatorio');
      if (!form.shortName.trim()) throw new Error('La sigla es obligatoria');
      return api.patch(`/circuits/${circuitId}`, {
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        season: form.season.trim(),
        description: form.description.trim(),
        city: form.city.trim(),
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim(),
        instagram: form.instagram.trim().replace(/^@/, ''),
        website: form.website.trim(),
      });
    },
    onSuccess: () => {
      invalidate();
      router.back();
    },
    onError: (error: unknown) =>
      Alert.alert('Error', apiErrorMessage(error, (error as Error)?.message || 'No se pudo guardar')),
  });

  const changeLogo = async () => {
    if (!circuitId) return;
    setUploadingLogo(true);
    const url = await pickAndUploadCircuitLogo(circuitId);
    setUploadingLogo(false);
    if (url) invalidate();
  };

  if (!circuit || !canEdit) {
    return (
      <Screen>
        <StackHeader title="Editar circuito" />
        <View style={{ padding: ui.spacing.lg }}>
          {isLoading ? (
            <Text style={{ color: ui.colors.textMuted }}>Cargando...</Text>
          ) : (
            <EmptyState
              icon={<Ionicons name="lock-closed-outline" size={32} color={ui.colors.textMuted} />}
              title={circuit ? 'Sin permiso para editar' : 'Circuito no encontrado'}
              description={circuit ? 'Solo el Presidente o un Organizador pueden editar el circuito.' : undefined}
            />
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <StackHeader title="Editar circuito" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 120 }}
      >
        <AppCard style={{ marginBottom: ui.spacing.md }}>
          <TouchableOpacity
            onPress={changeLogo}
            disabled={uploadingLogo}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                overflow: 'hidden',
                backgroundColor: 'rgba(20,184,166,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {circuit.logoUrl ? (
                <Image source={{ uri: circuit.logoUrl }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Ionicons name="image-outline" size={28} color={ui.colors.primary} />
              )}
              {uploadingLogo ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    backgroundColor: ui.colors.overlay,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator color={ui.colors.primary} />
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>Logo del circuito</Text>
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }}>
                Se muestra en el circuito y en los carteles de perfil del staff.
              </Text>
            </View>
          </TouchableOpacity>
        </AppCard>

        <AppCard>
          <InputField
            label="Nombre *"
            value={form.name}
            onChangeText={set('name')}
            placeholder="Ej: Circuito Amateur del Sur"
          />
          <InputField
            label="Sigla *"
            value={form.shortName}
            onChangeText={(v) => set('shortName')(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={12}
            placeholder="Ej: CAS"
            hint={`Aparece en los carteles de perfil: "${defaultCircuitTitle('PRESIDENT', form.shortName.trim() || 'de tu circuito')}".`}
          />
          <InputField label="Temporada" value={form.season} onChangeText={set('season')} placeholder="2026" />
          <InputField
            label="Descripción"
            value={form.description}
            onChangeText={set('description')}
            placeholder="Historia, objetivo y formato del circuito"
            multiline
          />
          <InputField label="Zona / ciudad" value={form.city} onChangeText={set('city')} placeholder="Ej: Zona Sur · GBA" />
          <InputField
            label="Teléfono de contacto"
            value={form.contactPhone}
            onChangeText={set('contactPhone')}
            keyboardType="phone-pad"
          />
          <InputField
            label="Email de contacto"
            value={form.contactEmail}
            onChangeText={set('contactEmail')}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <InputField
            label="Instagram"
            value={form.instagram}
            onChangeText={set('instagram')}
            autoCapitalize="none"
            placeholder="@micircuito"
          />
          <InputField
            label="Sitio web"
            value={form.website}
            onChangeText={set('website')}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://micircuito.com.ar"
          />
          <PrimaryButton
            label="Guardar"
            fullWidth
            style={{ marginTop: 8 }}
            loading={save.isPending}
            onPress={() => save.mutate()}
          />
        </AppCard>
      </ScrollView>
    </Screen>
  );
}
