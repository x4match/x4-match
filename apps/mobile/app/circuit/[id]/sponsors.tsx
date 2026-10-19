import { useMemo, useState } from 'react';
import { Alert, Image, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { safeMapCircuit } from '@/lib/mappers';
import { NO_CIRCUIT_ACCESS, apiErrorMessage, hasCircuitPermission } from '@/lib/circuits/staff';
import {
  SPONSOR_TIER_LABELS,
  createCircuitSponsor,
  deleteCircuitSponsor,
  fetchCircuitSponsors,
  pickAndUploadSponsorLogo,
  updateCircuitSponsor,
  type CircuitSponsor,
  type SponsorTier,
} from '@/lib/circuits/organizer';
import { ui } from '@/theme/tokens';
import {
  AppCard,
  EmptyState,
  InputField,
  PrimaryButton,
  Screen,
  SectionHeader,
  SegmentedControl,
  Sheet,
  StackHeader,
  withCircuitsEnabled,
} from '@/components/x4match';

const TIERS: SponsorTier[] = ['MAIN', 'GOLD', 'SILVER', 'SUPPORT'];

export default withCircuitsEnabled(CircuitSponsorsScreen);

function CircuitSponsorsScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const circuitId = Array.isArray(rawId) ? rawId[0] : rawId;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CircuitSponsor | 'new' | null>(null);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [tier, setTier] = useState<SponsorTier>('SUPPORT');
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const { data: circuitData } = useQuery({
    queryKey: ['circuit', circuitId],
    queryFn: async () => (await api.get(`/circuits/${circuitId}`)).data,
    enabled: !!circuitId,
  });
  const circuit = useMemo(() => safeMapCircuit(circuitData), [circuitData]);
  const canEdit = hasCircuitPermission(circuit?.viewer ?? NO_CIRCUIT_ACCESS, 'circuit.edit');

  const { data: sponsors = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['circuit-sponsors', circuitId],
    queryFn: () => fetchCircuitSponsors(circuitId!),
    enabled: !!circuitId,
  });

  const grouped = useMemo(
    () => TIERS.map((t) => [t, sponsors.filter((s) => s.tier === t)] as const).filter(([, rows]) => rows.length),
    [sponsors],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['circuit-sponsors', circuitId] });
    queryClient.invalidateQueries({ queryKey: ['circuit', circuitId] });
  };

  const openEditor = (item: CircuitSponsor | 'new') => {
    setEditing(item);
    setName(item === 'new' ? '' : item.name);
    setWebsite(item === 'new' ? '' : (item.website ?? ''));
    setTier(item === 'new' ? 'SUPPORT' : item.tier);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), website: website.trim() || undefined, tier };
      return editing === 'new' || !editing
        ? createCircuitSponsor(circuitId!, payload)
        : updateCircuitSponsor(circuitId!, editing.id, payload);
    },
    onSuccess: async (sponsor) => {
      const wasNew = editing === 'new';
      setEditing(null);
      invalidate();
      if (wasNew) {
        Alert.alert('Sponsor agregado', '¿Querés subir el logo ahora?', [
          { text: 'Después', style: 'cancel' },
          { text: 'Subir logo', onPress: () => uploadLogo(sponsor.id) },
        ]);
      }
    },
    onError: (error) => Alert.alert('Error', apiErrorMessage(error, 'No se pudo guardar el sponsor')),
  });

  const remove = useMutation({
    mutationFn: (sponsorId: string) => deleteCircuitSponsor(circuitId!, sponsorId),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: (error) => Alert.alert('Error', apiErrorMessage(error, 'No se pudo eliminar')),
  });

  async function uploadLogo(sponsorId: string) {
    setUploadingId(sponsorId);
    try {
      const updated = await pickAndUploadSponsorLogo(circuitId!, sponsorId);
      if (updated) invalidate();
    } finally {
      setUploadingId(null);
    }
  }

  const openWebsite = (url?: string | null) => {
    if (url) Linking.openURL(url).catch(() => undefined);
  };

  return (
    <Screen>
      <StackHeader title="Sponsors" />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
      >
        {canEdit ? (
          <PrimaryButton label="Agregar sponsor" fullWidth onPress={() => openEditor('new')} style={{ marginBottom: 16 }} />
        ) : null}

        {isLoading ? (
          <Text style={{ color: ui.colors.textMuted }}>Cargando...</Text>
        ) : sponsors.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="ribbon-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin sponsors"
            description="Los sponsors del circuito se muestran en la página del circuito y en cada fecha."
          />
        ) : (
          grouped.map(([t, rows]) => (
            <View key={t} style={{ marginBottom: 8 }}>
              <SectionHeader title={SPONSOR_TIER_LABELS[t]} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {rows.map((s) => (
                  <AppCard
                    key={s.id}
                    onPress={() => (canEdit ? openEditor(s) : openWebsite(s.website))}
                    style={{ width: t === 'MAIN' ? '100%' : '47%', alignItems: 'center', padding: 12 }}
                  >
                    {s.logo_url ? (
                      <Image
                        source={{ uri: s.logo_url }}
                        style={{ width: '100%', height: t === 'MAIN' ? 90 : 60 }}
                        resizeMode="contain"
                      />
                    ) : (
                      <View
                        style={{
                          width: '100%',
                          height: t === 'MAIN' ? 90 : 60,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: ui.colors.cardMuted,
                          borderRadius: ui.radius.md,
                        }}
                      >
                        <Ionicons name="image-outline" size={24} color={ui.colors.textMuted} />
                      </View>
                    )}
                    <Text style={{ marginTop: 8, fontWeight: '700', color: ui.colors.textPrimary }} numberOfLines={1}>
                      {s.name}
                    </Text>
                    {s.website ? (
                      <TouchableOpacity onPress={() => openWebsite(s.website)} hitSlop={6}>
                        <Text style={{ fontSize: 11, color: ui.colors.primary }} numberOfLines={1}>
                          {s.website.replace(/^https?:\/\//, '')}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </AppCard>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Sheet
        visible={editing != null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nuevo sponsor' : 'Editar sponsor'}
      >
        <View>
          <InputField label="Nombre" value={name} onChangeText={setName} maxLength={120} />
          <InputField
            label="Sitio web (opcional)"
            value={website}
            onChangeText={setWebsite}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="www.marca.com"
          />
          <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 6 }}>Nivel</Text>
          <SegmentedControl
            options={TIERS.map((value) => ({ value, label: SPONSOR_TIER_LABELS[value].replace('Sponsor ', '') }))}
            value={tier}
            onChange={setTier}
          />
          <PrimaryButton
            label="Guardar"
            fullWidth
            style={{ marginTop: 16 }}
            loading={save.isPending}
            disabled={!name.trim() || save.isPending}
            onPress={() => save.mutate()}
          />
          {editing && editing !== 'new' ? (
            <>
              <PrimaryButton
                label={editing.logo_url ? 'Cambiar logo' : 'Subir logo'}
                variant="outline"
                fullWidth
                style={{ marginTop: 8 }}
                loading={uploadingId === editing.id}
                onPress={() => uploadLogo(editing.id)}
              />
              <PrimaryButton
                label="Eliminar"
                variant="ghost"
                fullWidth
                style={{ marginTop: 8 }}
                loading={remove.isPending}
                onPress={() =>
                  Alert.alert('Eliminar sponsor', `¿Eliminar a ${editing.name}?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate(editing.id) },
                  ])
                }
              />
            </>
          ) : null}
        </View>
      </Sheet>
    </Screen>
  );
}
