import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, StatusBar, View, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type AppColors,
  type ThemeMode,
  type ThemePreference,
  palettes,
  setResolvedThemeMode,
} from '@/theme/tokens';

const STORAGE_KEY = 'x4match.themePreference';

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ThemeMode;
  colors: AppColors;
  setPreference: (next: ThemePreference) => void;
  cyclePreference: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveMode(preference: ThemePreference, system: ThemeMode | null | undefined): ThemeMode {
  if (preference === 'system') {
    return system === 'light' ? 'light' : 'dark';
  }
  return preference;
}

function ThemeTree({ children }: { children: ReactNode }) {
  const { resolved } = useTheme();
  // Remount subtree so screens reading `ui.colors` pick up the new palette.
  return (
    <View key={resolved} style={{ flex: 1 }}>
      {children}
    </View>
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const systemMode: ThemeMode | null | undefined =
    systemScheme === 'light' || systemScheme === 'dark' ? systemScheme : null;
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && (stored === 'light' || stored === 'dark' || stored === 'system')) {
          setPreferenceState(stored);
        }
      } catch {
        // keep default dark
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolved = useMemo(
    () => resolveMode(preference, systemMode),
    [preference, systemMode],
  );

  useEffect(() => {
    setResolvedThemeMode(resolved);
    try {
      Appearance.setColorScheme?.(resolved);
    } catch {
      // older RN without setColorScheme
    }
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const cyclePreference = useCallback(() => {
    setPreferenceState((prev) => {
      const order: ThemePreference[] = ['dark', 'light', 'system'];
      const next = order[(order.indexOf(prev) + 1) % order.length];
      void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      colors: palettes[resolved],
      setPreference,
      cyclePreference,
    }),
    [preference, resolved, setPreference, cyclePreference],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={resolved === 'light' ? 'dark-content' : 'light-content'}
        backgroundColor={palettes[resolved].bg}
      />
      <ThemeTree>{children}</ThemeTree>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

export function themePreferenceLabel(preference: ThemePreference): string {
  switch (preference) {
    case 'light':
      return 'Claro';
    case 'system':
      return 'Según el sistema';
    default:
      return 'Oscuro';
  }
}
