import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/lib/api';
import { signOutFromGoogle } from '@/lib/auth/google-auth';
import { getAccountVerificationState } from '@/lib/auth/verification';
import { queryClient } from '@/lib/query-client';
import { resolveSkillScore } from '@/lib/skill';
import { isPlayer } from '@/lib/roles';
import {
  registerForPushNotifications,
  unregisterPushNotifications,
} from '@/lib/notifications/push-notifications';

interface User {
  id: string;
  email: string;
  name: string;
  role?: 'PLAYER' | 'CLUB_ADMIN' | 'ORGANIZER' | 'SUPER_ADMIN';
  photo?: string;
  nickname?: string;
  phone?: string;
  gender?: string;
  birthDate?: string;
  description?: string;
  location?: string;
  dni?: string;
  fejubaId?: string;
  fejubaCategory?: string;
  fejubaFound?: boolean;
  rating?: number;
  skillScore?: number;
  levelCategory?: string;
  declaredCategory?: string;
  categoryStatus?: 'provisional' | 'confirmed';
  placementMatchesPlayed?: number;
  placementMatchesRequired?: number;
  mainClubId?: string;
  weeklyPoints?: number;
  monthlyPoints?: number;
  seasonPoints?: number;
  sports?: string[];
  preferredHand?: string;
  courtPosition?: string;
  matchType?: string;
  preferredPlayTime?: string;
  availabilityWindows?: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuth();
  }, []);

  useEffect(() => {
    if (!token) return;
    void registerForPushNotifications();
  }, [token]);

  const normalizeUser = (rawUser: User): User => ({
    ...rawUser,
    skillScore: resolveSkillScore(rawUser.skillScore, rawUser.rating),
  });

  const loadAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('auth_token');
      const storedUser = await SecureStore.getItemAsync('auth_user');

      if (storedToken && storedUser) {
        // Header primero: evita 401 si Home monta en el mismo tick que setUser.
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        setToken(storedToken);

        let nextUser = normalizeUser(JSON.parse(storedUser));
        try {
          const me = await api.get('/auth/me');
          if (me.data) {
            // Merge: /auth/me a veces no trae preferencias; no pisamos lo ya guardado.
            nextUser = normalizeUser({ ...nextUser, ...me.data });
          }
          if (isPlayer(nextUser.role)) {
            const profileRes = await api.get('/users/profile');
            const profile = profileRes.data ?? {};
            nextUser = normalizeUser({
              ...nextUser,
              nickname: profile.nickname || nextUser.nickname,
              gender: profile.gender || nextUser.gender,
              birthDate: profile.birthDate || nextUser.birthDate,
              declaredCategory: profile.declaredCategory || nextUser.declaredCategory,
              preferredHand:
                profile.preferences?.preferredHand || nextUser.preferredHand,
              courtPosition:
                profile.preferences?.courtPosition || nextUser.courtPosition,
              location: profile.location || nextUser.location,
              photo: profile.photo || nextUser.photo,
            });
          }
          await SecureStore.setItemAsync('auth_user', JSON.stringify(nextUser));
        } catch (refreshError) {
          if (getAccountVerificationState(refreshError)) {
            delete api.defaults.headers.common['Authorization'];
            await SecureStore.deleteItemAsync('auth_token');
            await SecureStore.deleteItemAsync('auth_user');
            setToken(null);
            return;
          }
          // Si falla el refresh, seguimos con el usuario cacheado.
        }
        setUser(nextUser);
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (newToken: string, newUser: User) => {
    try {
      const normalizedUser = normalizeUser(newUser);
      await SecureStore.setItemAsync('auth_token', newToken);
      await SecureStore.setItemAsync('auth_user', JSON.stringify(normalizedUser));
      // Header antes de clear/setState: clear() puede refetch queries montadas.
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      queryClient.clear();
      setToken(newToken);
      setUser(normalizedUser);
    } catch (error) {
      console.error('Error saving auth:', error);
    }
  };

  const logout = async () => {
    try {
      await unregisterPushNotifications();
      delete api.defaults.headers.common['Authorization'];
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('auth_user');
      await signOutFromGoogle();
      setToken(null);
      setUser(null);
      queryClient.clear();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const updateUser = async (updatedFields: Partial<User>) => {
    if (user) {
      const cleaned = Object.fromEntries(
        Object.entries(updatedFields).filter(([, value]) => value !== undefined),
      ) as Partial<User>;
      const updatedUser = normalizeUser({ ...user, ...cleaned });
      setUser(updatedUser);
      await SecureStore.setItemAsync('auth_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
