import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { addTournamentPhoto, deleteTournamentPhoto } from '@/lib/tournament/api';

export type FlyerPickSource = 'library' | 'camera';

export type PickedFlyer = {
  uri: string;
  dataUrl: string;
};

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export async function pickTournamentFlyer(source: FlyerPickSource): Promise<PickedFlyer | null> {
  if (source === 'library') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para subir el flyer');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return null;
    const asset = result.assets[0];
    const mime = guessMimeType(asset.uri);
    return { uri: asset.uri, dataUrl: `data:${mime};base64,${asset.base64}` };
  }

  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para sacar el flyer');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.8,
    base64: true,
  });

  if (result.canceled || !result.assets?.[0]?.base64) return null;
  const asset = result.assets[0];
  const mime = guessMimeType(asset.uri);
  return { uri: asset.uri, dataUrl: `data:${mime};base64,${asset.base64}` };
}

export function showFlyerPickerOptions({
  hasFlyer,
  onPick,
  onRemove,
}: {
  hasFlyer: boolean;
  onPick: (source: FlyerPickSource) => void;
  onRemove?: () => void;
}) {
  const options: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
    { text: 'Elegir de galería', onPress: () => onPick('library') },
    { text: 'Sacar foto', onPress: () => onPick('camera') },
  ];

  if (hasFlyer && onRemove) {
    options.push({ text: 'Quitar flyer', style: 'destructive', onPress: onRemove });
  }

  options.push({ text: 'Cancelar', style: 'cancel' });

  Alert.alert('Flyer del torneo', hasFlyer ? '¿Qué querés hacer?' : 'Agregá el flyer (opcional)', options);
}

export function getTournamentFlyer(
  photos?: { id: string; photo_url: string; caption?: string | null }[] | null,
) {
  if (!photos?.length) return null;
  return (
    photos.find((p) => (p.caption || '').toLowerCase() === 'flyer') ||
    photos[0]
  );
}

export async function uploadTournamentFlyer(
  tournamentId: string,
  dataUrl: string,
  existingFlyerId?: string | null,
) {
  if (existingFlyerId) {
    await deleteTournamentPhoto(tournamentId, existingFlyerId);
  }
  return addTournamentPhoto(tournamentId, { photoUrl: dataUrl, caption: 'Flyer' });
}
