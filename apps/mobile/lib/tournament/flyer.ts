import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { addTournamentPhotoFile, deleteTournamentPhoto } from '@/lib/tournament/api';

export type FlyerPickSource = 'library' | 'camera';

export type PickedFlyer = {
  uri: string;
  mimeType: string;
  fileName: string;
};

/**
 * Proporción de afiche horizontal (landscape).
 * Ideal: 1920×1080 (16:9) para que se vea entero en form, detalle y cards.
 */
export const FLYER_ASPECT = [16, 9] as const;
export const FLYER_ASPECT_RATIO = FLYER_ASPECT[0] / FLYER_ASPECT[1];
export const FLYER_RECOMMENDED_SIZE = '1920×1080';
export const FLYER_HINT = `Horizontal 16:9 · ideal ${FLYER_RECOMMENDED_SIZE} px`;

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function buildFilename(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext && ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext)) {
    return `flyer.${ext === 'jpeg' ? 'jpg' : ext}`;
  }
  return 'flyer.jpg';
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
      allowsEditing: true,
      aspect: [...FLYER_ASPECT],
      quality: 0.9,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return null;
    const asset = result.assets[0];
    return {
      uri: asset.uri,
      mimeType: asset.mimeType || guessMimeType(asset.uri),
      fileName: buildFilename(asset.uri),
    };
  }

  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para sacar el flyer');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [...FLYER_ASPECT],
    quality: 0.9,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    mimeType: asset.mimeType || guessMimeType(asset.uri),
    fileName: buildFilename(asset.uri),
  };
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
    {
      text: 'Elegir de galería',
      onPress: () => {
        // En Android el picker falla si se abre en el mismo tick que cierra el Alert.
        setTimeout(() => onPick('library'), 350);
      },
    },
    {
      text: 'Sacar foto',
      onPress: () => {
        setTimeout(() => onPick('camera'), 350);
      },
    },
  ];

  if (hasFlyer && onRemove) {
    options.push({ text: 'Quitar flyer', style: 'destructive', onPress: onRemove });
  }

  options.push({ text: 'Cancelar', style: 'cancel' });

  Alert.alert(
    'Flyer del torneo',
    hasFlyer
      ? '¿Qué querés hacer?'
      : `Agregá el afiche horizontal (${FLYER_HINT}).`,
    options,
  );
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
  flyer: PickedFlyer,
  existingFlyerId?: string | null,
) {
  if (existingFlyerId) {
    await deleteTournamentPhoto(tournamentId, existingFlyerId);
  }
  return addTournamentPhotoFile(tournamentId, flyer, 'Flyer');
}
