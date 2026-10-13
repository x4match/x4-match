import type { ComponentProps } from 'react';
import { Image, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { hasCircuitPermission, type CircuitViewerAccess } from '@/lib/circuits/staff';
import type { CircuitNews, CircuitSponsor } from '@/lib/circuits/organizer';
import { ui } from '@/theme/tokens';
import { AppCard, SectionHeader } from '@/components/x4match';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Shortcut = { key: string; label: string; hint: string; icon: IconName; href: string };

function ShortcutTile({ item, onPress }: { item: Shortcut; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        width: '48%',
        padding: 12,
        borderRadius: ui.radius.md,
        backgroundColor: ui.colors.cardMuted,
        gap: 6,
      }}
    >
      <Ionicons name={item.icon} size={20} color={ui.colors.primary} />
      <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{item.label}</Text>
      <Text style={{ fontSize: 11, color: ui.colors.textSecondary }} numberOfLines={2}>
        {item.hint}
      </Text>
    </TouchableOpacity>
  );
}

/** Gestión del circuito (padrón, ascensos, noticias, sponsors, actividad) + noticias y sponsors públicos. */
export function CircuitOrganizerSections({
  circuitId,
  access,
  news,
  sponsors,
}: {
  circuitId: string;
  access: CircuitViewerAccess;
  news: CircuitNews[];
  sponsors: CircuitSponsor[];
}) {
  const router = useRouter();
  const canEdit = hasCircuitPermission(access, 'circuit.edit');
  const canViewInternal = hasCircuitPermission(access, 'circuit.view_internal');
  const base = `/circuit/${circuitId}`;

  const shortcuts: Shortcut[] = canViewInternal
    ? [
        { key: 'players', label: 'Padrón', hint: 'Jugadores y su categoría', icon: 'people-outline', href: `${base}/players` },
        ...(canEdit
          ? [
              {
                key: 'promotions',
                label: 'Ascensos',
                hint: 'Quién sube y quién baja',
                icon: 'swap-vertical-outline' as IconName,
                href: `${base}/promotions`,
              },
            ]
          : []),
        { key: 'news', label: 'Noticias', hint: 'Novedades del circuito', icon: 'newspaper-outline', href: `${base}/news` },
        { key: 'sponsors', label: 'Sponsors', hint: 'Marcas que acompañan', icon: 'ribbon-outline', href: `${base}/sponsors` },
        { key: 'activity', label: 'Historial', hint: 'Quién hizo qué', icon: 'time-outline', href: `${base}/activity` },
      ]
    : [];

  return (
    <>
      {shortcuts.length ? (
        <>
          <SectionHeader title="Gestión del circuito" />
          <AppCard>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
              {shortcuts.map((item) => (
                <ShortcutTile key={item.key} item={item} onPress={() => router.push(item.href as any)} />
              ))}
            </View>
          </AppCard>
        </>
      ) : (
        <AppCard onPress={() => router.push(`${base}/players` as any)} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="people-outline" size={22} color={ui.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>Padrón de jugadores</Text>
              <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                Categoría de cada jugador en el circuito y sus estadísticas
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
          </View>
        </AppCard>
      )}

      {news.length ? (
        <>
          <SectionHeader
            title="Noticias"
            action={
              <TouchableOpacity onPress={() => router.push(`${base}/news` as any)} hitSlop={8}>
                <Text style={{ color: ui.colors.primary, fontWeight: '700', fontSize: 13 }}>Ver todas</Text>
              </TouchableOpacity>
            }
          />
          {news.map((item) => (
            <AppCard key={item.id} onPress={() => router.push(`${base}/news` as any)} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={{ width: 64, height: 64, borderRadius: ui.radius.md }} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {item.pinned ? <Ionicons name="pin" size={12} color={ui.colors.primary} /> : null}
                    <Text style={{ flex: 1, fontWeight: '700', color: ui.colors.textPrimary }} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 4 }} numberOfLines={2}>
                    {item.body}
                  </Text>
                </View>
              </View>
            </AppCard>
          ))}
        </>
      ) : null}

      {sponsors.length ? (
        <>
          <SectionHeader
            title="Sponsors"
            action={
              <TouchableOpacity onPress={() => router.push(`${base}/sponsors` as any)} hitSlop={8}>
                <Text style={{ color: ui.colors.primary, fontWeight: '700', fontSize: 13 }}>Ver todos</Text>
              </TouchableOpacity>
            }
          />
          <SponsorStrip sponsors={sponsors} />
        </>
      ) : null}
    </>
  );
}

export function SponsorStrip({ sponsors }: { sponsors: CircuitSponsor[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
      {sponsors.map((s) => (
        <TouchableOpacity
          key={s.id}
          disabled={!s.website}
          onPress={() => s.website && Linking.openURL(s.website).catch(() => undefined)}
          style={{
            width: s.tier === 'MAIN' ? 150 : 110,
            height: 64,
            borderRadius: ui.radius.md,
            backgroundColor: ui.colors.surface1,
            borderWidth: 1,
            borderColor: ui.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 8,
          }}
        >
          {s.logo_url ? (
            <Image source={{ uri: s.logo_url }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          ) : (
            <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, fontSize: 12 }} numberOfLines={2}>
              {s.name}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
