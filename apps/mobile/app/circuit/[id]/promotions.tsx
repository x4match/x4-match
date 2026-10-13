import { useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiErrorMessage } from '@/lib/circuits/staff';
import {
  applyLevelChanges,
  fetchPromotionSuggestions,
  levelLabel,
  type PromotionSuggestion,
} from '@/lib/circuits/organizer';
import { ui } from '@/theme/tokens';
import {
  AppCard,
  EmptyState,
  InputField,
  PrimaryButton,
  Screen,
  SectionHeader,
  StackHeader,
  withCircuitsEnabled,
} from '@/components/x4match';

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => onChange(Math.max(0, value - 1))} hitSlop={8}>
          <Ionicons name="remove-circle-outline" size={26} color={ui.colors.primary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: ui.colors.textPrimary, minWidth: 20, textAlign: 'center' }}>
          {value}
        </Text>
        <TouchableOpacity onPress={() => onChange(Math.min(20, value + 1))} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={26} color={ui.colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default withCircuitsEnabled(CircuitPromotionsScreen);

function CircuitPromotionsScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const circuitId = Array.isArray(rawId) ? rawId[0] : rawId;
  const queryClient = useQueryClient();
  const [promoteTop, setPromoteTop] = useState(2);
  const [relegateBottom, setRelegateBottom] = useState(2);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['circuit-promotions', circuitId, promoteTop, relegateBottom],
    queryFn: () => fetchPromotionSuggestions(circuitId!, { promoteTop, relegateBottom }),
    enabled: !!circuitId,
  });
  const suggestions = data?.suggestions ?? [];

  useEffect(() => {
    setSelected(new Set(suggestions.map((s) => s.playerId)));
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const byCategory = useMemo(() => {
    const map = new Map<string, PromotionSuggestion[]>();
    for (const s of suggestions) {
      const key = [s.categoryGender, s.categoryLabel].filter(Boolean).join(' ');
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [suggestions]);

  const apply = useMutation({
    mutationFn: () =>
      applyLevelChanges(
        circuitId!,
        suggestions
          .filter((s) => selected.has(s.playerId))
          .map((s) => ({ playerId: s.playerId, toLevel: s.toLevel, reason: s.direction })),
        note.trim() || undefined,
      ),
    onSuccess: ({ applied }) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-players', circuitId] });
      queryClient.invalidateQueries({ queryKey: ['circuit-promotions', circuitId] });
      setNote('');
      Alert.alert('Listo', `Se aplicaron ${applied} cambio(s) de categoría.`);
    },
    onError: (error) => Alert.alert('Error', apiErrorMessage(error, 'No se pudieron aplicar los cambios')),
  });

  const toggle = (playerId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });

  const confirmApply = () => {
    const count = suggestions.filter((s) => selected.has(s.playerId)).length;
    Alert.alert(
      'Aplicar cambios de categoría',
      `${count} jugador(es) cambian de categoría. Queda registrado en su historial.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aplicar', onPress: () => apply.mutate() },
      ],
    );
  };

  return (
    <Screen>
      <StackHeader title="Ascensos y descensos" />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
      >

        <AppCard style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Stepper label="Ascienden (primeros)" value={promoteTop} onChange={setPromoteTop} />
            <Stepper label="Descienden (últimos)" value={relegateBottom} onChange={setRelegateBottom} />
          </View>
        </AppCard>

        {isLoading ? (
          <Text style={{ color: ui.colors.textMuted }}>Calculando...</Text>
        ) : suggestions.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="swap-vertical-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin cambios sugeridos"
            description="Cuando haya ranking en categorías fijas (1ra a 8va) vas a ver acá quién sube y quién baja."
          />
        ) : (
          <>
            {byCategory.map(([category, rows]) => (
              <View key={category}>
                <SectionHeader title={category} subtitle={`${rows[0].totalRanked} en el ranking`} />
                {rows.map((s) => {
                  const on = selected.has(s.playerId);
                  const up = s.direction === 'PROMOTION';
                  return (
                    <AppCard key={s.playerId} onPress={() => toggle(s.playerId)} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Ionicons
                          name={on ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={on ? ui.colors.primary : ui.colors.textMuted}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{s.fullName}</Text>
                          <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                            {s.position}° · {s.points} pts
                          </Text>
                        </View>
                        <Ionicons
                          name={up ? 'arrow-up-circle' : 'arrow-down-circle'}
                          size={20}
                          color={up ? ui.colors.success : ui.colors.danger}
                        />
                        <Text style={{ fontWeight: '800', color: ui.colors.textPrimary }}>
                          {levelLabel(s.fromLevel)} → {levelLabel(s.toLevel)}
                        </Text>
                      </View>
                    </AppCard>
                  );
                })}
              </View>
            ))}
            <InputField label="Nota para el historial (opcional)" value={note} onChangeText={setNote} maxLength={300} placeholder="Ej: Cierre temporada 2026" />
            <PrimaryButton
              label={`Aplicar ${selected.size} cambio(s)`}
              fullWidth
              loading={apply.isPending}
              disabled={!selected.size || apply.isPending}
              onPress={confirmApply}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
