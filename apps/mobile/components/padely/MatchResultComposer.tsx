import { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { AppCard } from '@/components/ui';
import { PrimaryButton } from '@/components/ui';
import { PlayerRatingSection, buildPlayerRatingsPayload } from './PlayerRatingSection';
import { ui } from '@/theme/tokens';
import type { PlayerMatchRating, SetScore } from '@/lib/types';

type Player = { id: string; name: string; photo?: string };
type SetInput = { teamA: string; teamB: string };

type MatchResultComposerProps = {
  players: Player[];
  currentUserId?: string;
  initialSets?: SetScore[];
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  submitVariant?: 'primary' | 'dark' | 'outline';
  loading?: boolean;
  onSubmit: (payload: { sets: SetScore[]; playerRatings: PlayerMatchRating[] }) => void;
};

const EMPTY_SET: SetInput = { teamA: '', teamB: '' };

function toSetInput(set?: SetScore): SetInput {
  if (!set) return { ...EMPTY_SET };
  return {
    teamA: String(set.teamA ?? ''),
    teamB: String(set.teamB ?? ''),
  };
}

function SetRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SetInput;
  onChange: (next: SetInput) => void;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textSecondary, marginBottom: 8 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ textAlign: 'center', fontSize: 12, color: ui.colors.textMuted, marginBottom: 6 }}>
            Equipo A
          </Text>
          <TextInput
            value={value.teamA}
            onChangeText={(teamA) => onChange({ ...value, teamA })}
            keyboardType="number-pad"
            style={{
              height: 56,
              fontSize: 24,
              fontWeight: '800',
              textAlign: 'center',
              backgroundColor: ui.colors.cardMuted,
              borderRadius: ui.radius.md,
              color: ui.colors.textPrimary,
            }}
            placeholder="0"
            placeholderTextColor={ui.colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ textAlign: 'center', fontSize: 12, color: ui.colors.textMuted, marginBottom: 6 }}>
            Equipo B
          </Text>
          <TextInput
            value={value.teamB}
            onChangeText={(teamB) => onChange({ ...value, teamB })}
            keyboardType="number-pad"
            style={{
              height: 56,
              fontSize: 24,
              fontWeight: '800',
              textAlign: 'center',
              backgroundColor: ui.colors.cardMuted,
              borderRadius: ui.radius.md,
              color: ui.colors.textPrimary,
            }}
            placeholder="0"
            placeholderTextColor={ui.colors.textMuted}
          />
        </View>
      </View>
    </View>
  );
}

function parseSets(sets: SetInput[]): SetScore[] | null {
  const parsed: SetScore[] = [];
  for (const set of sets) {
    if (!set.teamA.trim() && !set.teamB.trim()) continue;
    const teamA = parseInt(set.teamA, 10);
    const teamB = parseInt(set.teamB, 10);
    if (Number.isNaN(teamA) || Number.isNaN(teamB)) return null;
    parsed.push({ teamA, teamB });
  }
  return parsed.length >= 2 ? parsed : null;
}

export function MatchResultComposer({
  players,
  currentUserId,
  initialSets,
  title = 'Completar resultado',
  subtitle = 'Cargá el marcador final y, si querés, dejá reseñas opcionales a otros jugadores.',
  submitLabel = 'Guardar resultado',
  submitVariant = 'dark',
  loading = false,
  onSubmit,
}: MatchResultComposerProps) {
  const [set1, setSet1] = useState<SetInput>(() => toSetInput(initialSets?.[0]));
  const [set2, setSet2] = useState<SetInput>(() => toSetInput(initialSets?.[1]));
  const [set3, setSet3] = useState<SetInput>(() => toSetInput(initialSets?.[2]));
  const [showThirdSet, setShowThirdSet] = useState(() => (initialSets?.length ?? 0) >= 3);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const initialSetsSignature = useMemo(() => JSON.stringify(initialSets ?? []), [initialSets]);

  useEffect(() => {
    setSet1(toSetInput(initialSets?.[0]));
    setSet2(toSetInput(initialSets?.[1]));
    setSet3(toSetInput(initialSets?.[2]));
    setShowThirdSet((initialSets?.length ?? 0) >= 3);
  }, [initialSetsSignature]);

  const handleSubmit = () => {
    const sets = parseSets(showThirdSet ? [set1, set2, set3] : [set1, set2]);
    if (!sets) {
      Alert.alert('Resultado incompleto', 'Completá al menos los 2 primeros sets con juegos válidos.');
      return;
    }

    onSubmit({
      sets,
      playerRatings: buildPlayerRatingsPayload(ratings),
    });
  };

  return (
    <AppCard>
      <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textPrimary, marginBottom: 6 }}>
        {title}
      </Text>
      <Text style={{ fontSize: 13, color: ui.colors.textSecondary, lineHeight: 19, marginBottom: 16 }}>
        {subtitle}
      </Text>

      <SetRow label="Set 1" value={set1} onChange={setSet1} />
      <SetRow label="Set 2" value={set2} onChange={setSet2} />

      {showThirdSet ? (
        <SetRow label="Set 3" value={set3} onChange={setSet3} />
      ) : (
        <PrimaryButton
          label="Agregar tercer set"
          variant="outline"
          size="sm"
          onPress={() => setShowThirdSet(true)}
          fullWidth
          style={{ marginBottom: 8 }}
        />
      )}

      <PlayerRatingSection
        players={players}
        currentUserId={currentUserId}
        ratings={ratings}
        onChange={(userId, score) =>
          setRatings((prev) => {
            const next = { ...prev };
            if (score == null) delete next[userId];
            else next[userId] = score;
            return next;
          })
        }
        title="Reseñas de jugadores (opcional)"
        subtitle="Del 1 al 5 · elegí solamente a quienes quieras valorar"
      />

      <PrimaryButton
        label={submitLabel}
        onPress={handleSubmit}
        loading={loading}
        fullWidth
        size="lg"
        variant={submitVariant}
        style={{ marginTop: 8 }}
      />
    </AppCard>
  );
}
