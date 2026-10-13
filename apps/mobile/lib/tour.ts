import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'x4match:screen-tour:';

function storageKey(userId: string, tourId: string) {
  return `${STORAGE_PREFIX}${userId}:${tourId}`;
}

export async function hasSeenScreenTour(userId: string, tourId: string): Promise<boolean> {
  try {
    return Boolean(await AsyncStorage.getItem(storageKey(userId, tourId)));
  } catch {
    return false;
  }
}

export async function markScreenTourSeen(userId: string, tourId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId, tourId), new Date().toISOString());
  } catch {
    // Sin persistencia el tutorial vuelve a mostrarse; no bloquea la app.
  }
}

/** Vuelve a habilitar todos los tutoriales de pantalla del usuario. */
export async function resetScreenTours(userId: string): Promise<void> {
  try {
    const prefix = `${STORAGE_PREFIX}${userId}:`;
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((key) => key.startsWith(prefix));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // ignore
  }
}
