import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

export type ClubLogoSource = 'library' | 'camera';

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
    return `club-logo.${ext === 'jpeg' ? 'jpg' : ext}`;
  }
  return 'club-logo.jpg';
}

async function pickImage(source: ClubLogoSource): Promise<string | null> {
  if (source === 'library') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para cambiar el logo');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) return null;
    return result.assets[0].uri;
  }

  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para sacar una foto');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
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
  return 'No se pudo subir el logo';
}

export async function uploadClubLogoFromUri(clubId: string, uri: string): Promise<string> {
  const formData = new FormData();
  const filename = buildUploadFilename(uri);
  const type = guessMimeType(uri);

  formData.append('logo', {
    uri,
    name: filename,
    type,
  } as any);

  const response = await api.post(`/clubs/${clubId}/logo`, formData);
  return (response.data.logo_url || response.data.logoUrl) as string;
}

export async function pickAndUploadClubLogo(
  clubId: string,
  source: ClubLogoSource,
): Promise<string | null> {
  const uri = await pickImage(source);
  if (!uri) return null;

  try {
    return await uploadClubLogoFromUri(clubId, uri);
  } catch (error) {
    Alert.alert('Error', uploadErrorMessage(error));
    return null;
  }
}

export function showClubLogoOptions({
  hasLogo,
  onView,
  onPick,
}: {
  hasLogo: boolean;
  onView?: () => void;
  onPick: (source: ClubLogoSource) => void;
}) {
  const options: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [];

  if (hasLogo && onView) {
    options.push({ text: 'Ver foto', onPress: onView });
  }

  options.push(
    { text: 'Elegir de galería', onPress: () => onPick('library') },
    { text: 'Sacar foto', onPress: () => onPick('camera') },
    { text: 'Cancelar', style: 'cancel' },
  );

  Alert.alert('Foto del club', hasLogo ? '¿Qué querés hacer?' : 'Agregá la foto del club', options);
}
