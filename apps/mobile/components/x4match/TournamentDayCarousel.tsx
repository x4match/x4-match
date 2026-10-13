import { Dimensions, ScrollView, Text, View } from 'react-native';
import type { Tournament } from '@/lib/types';
import { ui } from '@/theme/tokens';
import { TournamentCard } from './TournamentCard';

const CARD_WIDTH = Math.min(Dimensions.get('window').width * 0.82, 320);
const CARD_GAP = 12;

type TournamentDayCarouselProps = {
  tournaments: Tournament[];
  onPressTournament: (tournament: Tournament) => void;
  title?: string;
};

export function TournamentDayCarousel({
  tournaments,
  onPressTournament,
  title = 'Torneos del día',
}: TournamentDayCarouselProps) {
  if (!tournaments.length) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '700',
          color: ui.colors.primary,
          marginBottom: 10,
          paddingHorizontal: 2,
        }}
      >
        {title}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        contentContainerStyle={{ paddingRight: 8, gap: CARD_GAP }}
      >
        {tournaments.map((tournament) => (
          <TournamentCard
            key={tournament.id}
            tournament={tournament}
            onPress={() => onPressTournament(tournament)}
            variant="compact"
            width={CARD_WIDTH}
          />
        ))}
      </ScrollView>
    </View>
  );
}
