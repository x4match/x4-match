import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

export type ClubCoverSource = 'library' | 'camera';

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function buildUploadFilename(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  if (ext && ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext)) {
    return `club-cover.${ext === 'jpeg' ? 'jpg' : ext}`;
  }
  return 'club-cover.jpg';
}

async function pickImage(source: ClubCoverSource): Promise<string | null> {
  if (source === 'library') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para la portada');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return null;
    return result.assets[0].uri;
  }

  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para la portada');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

function uploadErrorMessage(error: unknown): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data
    ?.message;
  if (Array.isArray(message)) return message.join('\n');
  if (typeof message === 'string') return message;
  return 'No se pudo subir la portada';
}

export async function uploadClubCoverFromUri(clubId: string, uri: string): Promise<string> {
  const formData = new FormData();
  formData.append('cover', {
    uri,
    name: buildUploadFilename(uri),
    type: guessMimeType(uri),
  } as any);

  const response = await api.post(`/clubs/${clubId}/cover`, formData);
  return (response.data.cover_url || response.data.coverUrl) as string;
}

export async function pickAndUploadClubCover(
  clubId: string,
  source: ClubCoverSource,
): Promise<string | null> {
  const uri = await pickImage(source);
  if (!uri) return null;

  try {
    return await uploadClubCoverFromUri(clubId, uri);
  } catch (error) {
    Alert.alert('Error', uploadErrorMessage(error));
    return null;
  }
}

export function showClubCoverOptions({
  hasCover,
  onPick,
}: {
  hasCover: boolean;
  onPick: (source: ClubCoverSource) => void;
}) {
  Alert.alert(
    'Foto de portada',
    hasCover ? '¿Qué querés hacer?' : 'Agregá una portada para tu club',
    [
      { text: 'Elegir de galería', onPress: () => onPick('library') },
      { text: 'Sacar foto', onPress: () => onPick('camera') },
      { text: 'Cancelar', style: 'cancel' },
    ],
  );
}
