import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import type { ManagerClientRow, ManagerReport } from '@/lib/club-manager';
import { formatCurrency } from '@/lib/currency';
import { ui } from '@/theme/tokens';
import {
  Screen,
  StackHeader,
  AppCard,
  EmptyState,
  Avatar,
  PressableScale,
  FadeInUp,
  SkeletonCard,
  SectionHeader,
  SelectionChip,
  PrimaryButton,
  InputField,
  Sheet,
} from '@/components/padely';
import {
  ClubPicker,
  resolveActiveClubId,
  useMineClubs,
} from '@/components/club/ClubPicker';

type Segment = 'new' | 'frequent' | 'inactive' | 'top';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'new', label: 'Nuevos' },
  { key: 'frequent', label: 'Frecuentes' },
  { key: 'inactive', label: 'Inactivos' },
  { key: 'top', label: 'Top' },
];

function ClientRow({
  client,
  onPress,
}: {
  client: ManagerClientRow;
  onPress: () => void;
}) {
  const lastVisit =
    client.daysSince != null
      ? client.daysSince === 0
        ? 'Hoy'
        : `Hace ${client.daysSince} días`
      : 'Sin visitas';

  return (
    <PressableScale onPress={onPress}>
      <AppCard padding="sm" style={{ marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={client.name} photo={client.photoUrl || undefined} size="md" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, fontSize: 14 }}>
              {client.nickname || client.name}
            </Text>
            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
              Última visita · {lastVisit}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>
                {client.matchesAtClub} reservas
              </Text>
              <Text style={{ fontSize: 11, color: ui.colors.primary, fontWeight: '600' }}>
                {formatCurrency(client.spent)}
              </Text>
              {client.debt > 0 ? (
                <Text style={{ fontSize: 11, color: ui.colors.danger, fontWeight: '700' }}>
                  Deuda {formatCurrency(client.debt)}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: ui.colors.primary }}>
              Ver perfil
            </Text>
            <Ionicons name="chevron-forward" size={16} color={ui.colors.textMuted} />
          </View>
        </View>
      </AppCard>
    </PressableScale>
  );
}

export default function ClubClientsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const canManage = isClub(user?.role);
  const params = useLocalSearchParams<{ clubId?: string; clubName?: string }>();
  const [selectedClubId, setSelectedClubId] = useState<string | null>(params.clubId || null);
  const [segment, setSegment] = useState<Segment>('frequent');
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignBody, setCampaignBody] = useState('');

  const { data: clubs } = useMineClubs(canManage);
  const activeClubId = useMemo(
    () => resolveActiveClubId(selectedClubId || params.clubId || null, clubs),
    [selectedClubId, params.clubId, clubs],
  );
  const activeClub = clubs?.find((c) => c.id === activeClubId);
  const clubName = activeClub?.name || params.clubName || 'el club';

  const { data: report, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['club-manager-report', activeClubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${activeClubId}/manager-report`, { params: { days: 30 } });
      return res.data as ManagerReport;
    },
    enabled: canManage && !!activeClubId,
  });

  const campaignMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/clubs/${activeClubId}/segments/notify`, {
        segment,
        title: campaignTitle.trim(),
        body: campaignBody.trim(),
        actionLabel: 'Ver club',
      });
      return res.data as { sent: number };
    },
    onSuccess: (res) => {
      setCampaignOpen(false);
      setCampaignTitle('');
      setCampaignBody('');
      Alert.alert('Campaña enviada', `Se notificó a ${res.sent} jugadores.`);
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo enviar la campaña');
    },
  });

  const openCampaign = () => {
    setCampaignTitle(
      segment === 'inactive'
        ? `Te extrañamos en ${clubName}`
        : `Novedades de ${clubName}`,
    );
    setCampaignBody(
      segment === 'inactive'
        ? 'Hay turnos libres esta semana. Volvé a jugar con nosotros.'
        : 'Reservá tu próxima cancha desde la app.',
    );
    setCampaignOpen(true);
  };

  if (!canManage) {
    return (
      <Screen>
        <StackHeader title="Clientes" />
        <EmptyState
          icon={<Ionicons name="lock-closed-outline" size={32} color={ui.colors.textMuted} />}
          title="Acceso restringido"
        />
      </Screen>
    );
  }

  const counts = report?.clientsSummary.counts;
  const rows = report?.clientsSummary.segments[segment] ?? [];
  const segmentLabel = SEGMENTS.find((s) => s.key === segment)?.label || segment;

  return (
    <Screen>
      <StackHeader title="Clientes" />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={ui.colors.primary}
          />
        }
      >
        <ClubPicker
          selectedClubId={activeClubId}
          onSelect={setSelectedClubId}
          enabled={canManage}
        />

        {isLoading || !report ? (
          <View style={{ gap: 12 }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : (
          <>
            <FadeInUp index={0}>
              <SectionHeader
                title={report.clientsSummary.title}
                subtitle={report.clientsSummary.subtitle}
              />
              <PrimaryButton
                label="Enviar campaña"
                fullWidth
                icon={<Ionicons name="megaphone-outline" size={18} color="#fff" />}
                onPress={openCampaign}
                style={{ marginBottom: 16 }}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'Nuevos', value: counts?.new ?? 0 },
                  { label: 'Frecuentes', value: counts?.frequent ?? 0 },
                  { label: 'Inactivos', value: counts?.inactive ?? 0 },
                  { label: 'Top', value: counts?.top ?? 0 },
                ].map((c) => (
                  <View
                    key={c.label}
                    style={{
                      width: '48%',
                      backgroundColor: ui.colors.surface1,
                      borderRadius: ui.radius.lg,
                      borderWidth: 1,
                      borderColor: ui.colors.border,
                      padding: 12,
                    }}
                  >
                    <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>{c.label}</Text>
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: '800',
                        color: ui.colors.textPrimary,
                        marginTop: 4,
                      }}
                    >
                      {c.value}
                    </Text>
                  </View>
                ))}
              </View>
            </FadeInUp>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {SEGMENTS.map((s) => (
                  <SelectionChip
                    key={s.key}
                    label={s.label}
                    selected={segment === s.key}
                    onPress={() => setSegment(s.key)}
                  />
                ))}
              </View>
            </ScrollView>

            {rows.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="people-outline" size={36} color={ui.colors.textMuted} />}
                title="Sin clientes en este segmento"
                description="Cuando haya actividad van a aparecer acá."
              />
            ) : (
              rows.map((client, index) => (
                <FadeInUp key={client.userId} index={index + 1}>
                  <ClientRow
                    client={client}
                    onPress={() =>
                      router.push({ pathname: '/player/[id]', params: { id: client.userId } })
                    }
                  />
                </FadeInUp>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Sheet
        visible={campaignOpen}
        onClose={() => setCampaignOpen(false)}
        title={`Campaña a ${segmentLabel}`}
      >
        <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 12, lineHeight: 18 }}>
          Se envía como notificación in-app a hasta 100 jugadores del segmento.
        </Text>
        <InputField
          label="Título"
          value={campaignTitle}
          onChangeText={setCampaignTitle}
          placeholder="Título de la notificación"
        />
        <InputField
          label="Mensaje"
          value={campaignBody}
          onChangeText={setCampaignBody}
          placeholder="Texto de la campaña"
          multiline
        />
        <PrimaryButton
          label="Enviar"
          fullWidth
          loading={campaignMutation.isPending}
          disabled={!campaignTitle.trim() || !campaignBody.trim()}
          onPress={() => campaignMutation.mutate()}
        />
      </Sheet>
    </Screen>
  );
}
