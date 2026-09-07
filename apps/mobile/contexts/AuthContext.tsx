import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/lib/api';
import { signOutGoogle } from '@/lib/google-auth';
import { queryClient } from '@/lib/query-client';
import { resolveSkillScore } from '@/lib/skill';

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

  const normalizeUser = (rawUser: User): User => ({
    ...rawUser,
    skillScore: resolveSkillScore(rawUser.skillScore, rawUser.rating),
  });

  const loadAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('auth_token');
      const storedUser = await SecureStore.getItemAsync('auth_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(normalizeUser(JSON.parse(storedUser)));
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
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
      // Evita mostrar clubs/canchas cacheados de otra sesión
      queryClient.clear();
      setToken(newToken);
      setUser(normalizedUser);
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } catch (error) {
      console.error('Error saving auth:', error);
    }
  };

  const logout = async () => {
    try {
      await signOutGoogle();
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('auth_user');
      setToken(null);
      setUser(null);
      delete api.defaults.headers.common['Authorization'];
      queryClient.clear();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const updateUser = async (updatedFields: Partial<User>) => {
    if (user) {
      const updatedUser = normalizeUser({ ...user, ...updatedFields });
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
