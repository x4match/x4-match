import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type PlatformVersion = {
  latestVersion: string | null;
  minVersion: string | null;
  storeUrl: string | null;
};

type AppVersionConfig = {
  ios: PlatformVersion;
  android: PlatformVersion;
  message: string | null;
};

export type AppUpdateState =
  | { kind: 'none' }
  | { kind: 'suggested' | 'required'; latestVersion: string | null; storeUrl: string; message: string | null };

const DISMISSED_KEY = 'x4match:app-update:dismissed-version';

export function currentAppVersion(): string | null {
  return Constants.expoConfig?.version ?? null;
}

/** Compara versiones numéricas tipo 1.2.3. Devuelve <0, 0 o >0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number(n) || 0);
  const pb = b.split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Compara la versión instalada con la configurada en el backoffice.
 * Por debajo de la mínima la actualización es obligatoria; por debajo de la última, una sugerencia
 * que se puede descartar (una vez por versión).
 */
export function useAppUpdate() {
  const query = useQuery({
    queryKey: ['app-version'],
    queryFn: async () => (await api.get<AppVersionConfig>('/app-version')).data,
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const { refetch } = query;
  const [dismissedVersion, setDismissedVersion] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((value) => setDismissedVersion(value))
      .catch(() => setDismissedVersion(null));
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  const dismiss = useCallback((version: string | null) => {
    if (!version) return;
    setDismissedVersion(version);
    AsyncStorage.setItem(DISMISSED_KEY, version).catch(() => {});
  }, []);

  let state: AppUpdateState = { kind: 'none' };
  const installed = currentAppVersion();
  const platformConfig =
    Platform.OS === 'ios' ? query.data?.ios : Platform.OS === 'android' ? query.data?.android : null;

  if (installed && platformConfig?.storeUrl && dismissedVersion !== undefined) {
    const { latestVersion, minVersion, storeUrl } = platformConfig;
    const base = { latestVersion, storeUrl, message: query.data?.message ?? null };
    if (minVersion && compareVersions(installed, minVersion) < 0) {
      state = { kind: 'required', ...base };
    } else if (
      latestVersion &&
      compareVersions(installed, latestVersion) < 0 &&
      dismissedVersion !== latestVersion
    ) {
      state = { kind: 'suggested', ...base };
    }
  }

  return { state, dismiss };
}
