import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';

export type ClubPhotoSource = 'library' | 'camera';

export type ClubPhoto = {
  id: string;
  clubId?: string;
  photoUrl: string;
  isPrimary?: boolean;
  sortOrder?: number;
};

export const CLUB_PHOTOS_MAX = 8;

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
    return `club-photo.${ext === 'jpeg' ? 'jpg' : ext}`;
  }
  return 'club-photo.jpg';
}

function uploadErrorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data
    ?.message;
  if (Array.isArray(message)) return message.join('\n');
  if (typeof message === 'string') return message;
  return fallback;
}

async function pickImages(
  source: ClubPhotoSource,
  selectionLimit = 1,
): Promise<string[]> {
  if (source === 'library') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para las fotos del club');
      return [];
    }

    const limit = Math.max(1, selectionLimit);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
      // Cropping is incompatible with multi-select in expo-image-picker.
      allowsEditing: limit === 1,
      aspect: [16, 9],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) return [];
    return result.assets.map((asset) => asset.uri).filter(Boolean);
  }

  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara');
    return [];
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [16, 9],
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.[0]) return [];
  return [result.assets[0].uri];
}

export async function fetchClubPhotos(clubId: string): Promise<ClubPhoto[]> {
  const res = await api.get(`/clubs/${clubId}/photos`);
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map((row: any) => ({
    id: row.id,
    clubId: row.clubId ?? row.club_id,
    photoUrl: row.photoUrl ?? row.photo_url,
    isPrimary: Boolean(row.isPrimary ?? row.is_primary),
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
  }));
}

export async function uploadClubPhotoFromUri(clubId: string, uri: string): Promise<ClubPhoto> {
  const formData = new FormData();
  formData.append('photo', {
    uri,
    name: buildUploadFilename(uri),
    type: guessMimeType(uri),
  } as any);

  const response = await api.post(`/clubs/${clubId}/photos`, formData);
  const row = response.data;
  return {
    id: row.id,
    clubId: row.clubId ?? row.club_id,
    photoUrl: row.photoUrl ?? row.photo_url,
    isPrimary: Boolean(row.isPrimary ?? row.is_primary),
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
  };
}

export async function pickAndUploadClubPhotos(
  clubId: string,
  source: ClubPhotoSource,
  options?: { remainingSlots?: number },
): Promise<ClubPhoto[]> {
  const remaining = Math.max(1, options?.remainingSlots ?? CLUB_PHOTOS_MAX);
  const uris = await pickImages(source, source === 'library' ? remaining : 1);
  if (!uris.length) return [];

  const uploaded: ClubPhoto[] = [];
  const errors: string[] = [];

  for (const uri of uris) {
    try {
      uploaded.push(await uploadClubPhotoFromUri(clubId, uri));
    } catch (error) {
      errors.push(uploadErrorMessage(error, 'No se pudo subir una foto'));
    }
  }

  if (!uploaded.length) {
    Alert.alert('Error', errors[0] || 'No se pudieron subir las fotos');
    return [];
  }

  if (errors.length) {
    Alert.alert(
      'Subida parcial',
      `Se subieron ${uploaded.length} de ${uris.length} fotos. ${errors[0]}`,
    );
  }

  return uploaded;
}

/** @deprecated Prefer pickAndUploadClubPhotos for multi-select support */
export async function pickAndUploadClubPhoto(
  clubId: string,
  source: ClubPhotoSource,
): Promise<ClubPhoto | null> {
  const photos = await pickAndUploadClubPhotos(clubId, source, { remainingSlots: 1 });
  return photos[0] ?? null;
}

export async function setClubPhotoPrimary(clubId: string, photoId: string): Promise<ClubPhoto[]> {
  const res = await api.post(`/clubs/${clubId}/photos/${photoId}/primary`);
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map((row: any) => ({
    id: row.id,
    clubId: row.clubId ?? row.club_id,
    photoUrl: row.photoUrl ?? row.photo_url,
    isPrimary: Boolean(row.isPrimary ?? row.is_primary),
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
  }));
}

export async function deleteClubPhoto(clubId: string, photoId: string): Promise<ClubPhoto[]> {
  const res = await api.delete(`/clubs/${clubId}/photos/${photoId}`);
  const rows = Array.isArray(res.data) ? res.data : [];
  return rows.map((row: any) => ({
    id: row.id,
    clubId: row.clubId ?? row.club_id,
    photoUrl: row.photoUrl ?? row.photo_url,
    isPrimary: Boolean(row.isPrimary ?? row.is_primary),
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
  }));
}

export function showClubPhotoOptions({
  onPick,
  remainingSlots = CLUB_PHOTOS_MAX,
}: {
  onPick: (source: ClubPhotoSource) => void;
  remainingSlots?: number;
}) {
  const galleryLabel =
    remainingSlots > 1 ? 'Elegir de galería (varias)' : 'Elegir de galería';
  Alert.alert(
    'Fotos para cards',
    remainingSlots > 1
      ? `Podés elegir hasta ${remainingSlots} fotos de la cancha`
      : 'Elegí una foto de la cancha para los partidos abiertos',
    [
      { text: galleryLabel, onPress: () => onPick('library') },
      { text: 'Sacar foto', onPress: () => onPick('camera') },
      { text: 'Cancelar', style: 'cancel' },
    ],
  );
}
