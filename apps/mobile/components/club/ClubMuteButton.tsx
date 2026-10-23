import { Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '@/theme/tokens';
import { useMutedClubs, useToggleClubMute } from '@/lib/notifications/muted-clubs';

export function ClubMuteButton({ clubId, clubName }: { clubId: string; clubName: string }) {
  const { data: mutedClubs } = useMutedClubs();
  const toggle = useToggleClubMute();
  const muted = !!mutedClubs?.some((club) => club.clubId === clubId);

  const onPress = () => {
    if (muted) {
      toggle.mutate(
        { clubId, muted: false },
        { onError: () => Alert.alert('Error', 'No se pudo reactivar los avisos de este club') },
      );
      return;
    }
    Alert.alert(
      `Silenciar ${clubName}`,
      'No vas a recibir canchas libres, partidos abiertos ni promociones de este club. Los avisos de tus partidos y reservas siguen llegando.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Silenciar',
          style: 'destructive',
          onPress: () =>
            toggle.mutate(
              { clubId, muted: true, name: clubName },
              { onError: () => Alert.alert('Error', 'No se pudo silenciar el club') },
            ),
        },
      ],
    );
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={toggle.isPending}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={muted ? 'Reactivar avisos del club' : 'Silenciar avisos del club'}
    >
      <Ionicons
        name={muted ? 'notifications-off' : 'notifications-outline'}
        size={22}
        color={muted ? ui.colors.textMuted : ui.colors.textPrimary}
      />
    </TouchableOpacity>
  );
}
