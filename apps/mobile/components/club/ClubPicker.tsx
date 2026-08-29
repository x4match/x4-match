import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SelectionChip } from '@/components/padely';

export type MineClub = { id: string; name: string };

type ClubPickerProps = {
  selectedClubId: string | null;
  onSelect: (clubId: string) => void;
  enabled?: boolean;
};

export function useMineClubs(enabled = true) {
  return useQuery({
    queryKey: ['clubs-mine'],
    queryFn: async () => {
      const res = await api.get('/clubs/mine');
      return res.data as MineClub[];
    },
    enabled,
  });
}

export function ClubPicker({ selectedClubId, onSelect, enabled = true }: ClubPickerProps) {
  const { data: clubs } = useMineClubs(enabled);

  if (!clubs || clubs.length <= 1) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {clubs.map((club) => (
          <SelectionChip
            key={club.id}
            label={club.name}
            selected={club.id === selectedClubId}
            onPress={() => onSelect(club.id)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

export function resolveActiveClubId(
  selectedClubId: string | null,
  clubs?: MineClub[] | null,
): string | null {
  if (selectedClubId && clubs?.some((c) => c.id === selectedClubId)) {
    return selectedClubId;
  }
  return clubs?.[0]?.id || null;
}
