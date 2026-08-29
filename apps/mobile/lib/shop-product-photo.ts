import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

export type ShopProductPhotoSource = 'library' | 'camera';

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
    return `shop-product.${ext === 'jpeg' ? 'jpg' : ext}`;
  }
  return 'shop-product.jpg';
}

export async function pickShopProductPhoto(source: ShopProductPhotoSource): Promise<string | null> {
  if (source === 'library') {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para la foto del producto');
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
  return 'No se pudo subir la foto del producto';
}

export async function uploadShopProductPhotoFromUri(
  clubId: string,
  productId: string,
  uri: string,
): Promise<string> {
  const formData = new FormData();
  const filename = buildUploadFilename(uri);
  const type = guessMimeType(uri);

  formData.append('photo', {
    uri,
    name: filename,
    type,
  } as any);

  const response = await api.post(`/clubs/${clubId}/shop/products/${productId}/photo`, formData);
  return (response.data.photo_url || response.data.photoUrl) as string;
}

export async function pickAndUploadShopProductPhoto(
  clubId: string,
  productId: string,
  source: ShopProductPhotoSource,
): Promise<string | null> {
  const uri = await pickShopProductPhoto(source);
  if (!uri) return null;

  try {
    return await uploadShopProductPhotoFromUri(clubId, productId, uri);
  } catch (error) {
    Alert.alert('Error', uploadErrorMessage(error));
    return null;
  }
}

export function showShopProductPhotoOptions({
  hasPhoto,
  onPick,
}: {
  hasPhoto: boolean;
  onPick: (source: ShopProductPhotoSource) => void;
}) {
  Alert.alert(
    'Foto del producto',
    hasPhoto ? '¿Qué querés hacer?' : 'Agregá una foto del producto',
    [
      { text: 'Elegir de galería', onPress: () => onPick('library') },
      { text: 'Sacar foto', onPress: () => onPick('camera') },
      { text: 'Cancelar', style: 'cancel' },
    ],
  );
}
