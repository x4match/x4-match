import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const SPORTS = ['Pádel', 'Tenis', 'Pickleball'] as const;
const RESULT_FILTERS = [
  { label: '5 resultados', value: 5 },
  { label: '10 resultados', value: 10 },
  { label: 'Todos', value: 0 },
] as const;


interface ProfileData {
  id: string;
  name: string;
  email: string;
  photo?: string;
  location?: string;
  rating: number;
  sports: string[];
  stats: {
    matches: number;
    wins: number;
    losses: number;
    followers: number;
    following: number;
  };
  preferences: {
    preferredHand?: string;
    courtPosition?: string;
    matchType?: string;
    preferredPlayTime?: string;
  };
}

interface MatchHistoryEntry {
  matchId: string;
  date: string;
  result: 'win' | 'loss' | 'draw';
  score: string;
  ratingChange: number;
  ratingAfter: number;
  opponent: string[];
}

interface MatchHistory {
  currentRating: number;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  history: MatchHistoryEntry[];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Componente de barra del gráfico ───
function RatingBar({
  entry,
  maxHeight,
  minRating,
  ratingRange,
}: {
  entry: MatchHistoryEntry;
  maxHeight: number;
  minRating: number;
  ratingRange: number;
}) {
  const barHeight = ratingRange > 0
    ? Math.max(12, ((entry.ratingAfter - minRating) / ratingRange) * maxHeight)
    : maxHeight * 0.5;

  const barColor =
    entry.result === 'win'
      ? 'bg-green-500'
      : entry.result === 'loss'
        ? 'bg-red-400'
        : 'bg-amber-400';

  return (
    <View className="flex-1 items-center justify-end">
      <Text className="text-[8px] text-gray-400 mb-1">
        {entry.ratingChange > 0 ? '+' : ''}
        {entry.ratingChange}
      </Text>
      <View
        className={`w-3 ${barColor} rounded-full`}
        style={{ height: barHeight }}
      />
    </View>
  );
}

// ════════════════════════════════════════════
// ─── Pantalla principal ───────────────────
// ════════════════════════════════════════════
export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();

  // State principal
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedResultFilter, setSelectedResultFilter] = useState(0);

  // State de deportes
  const [savingSports, setSavingSports] = useState(false);

  // ─── Carga de datos ───
  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadMatchHistory();
    }, []),
  );

  const loadProfile = async () => {
    try {
      const response = await api.get('/users/profile');
      setProfile(response.data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMatchHistory = async (limit?: number) => {
    try {
      const params = limit ? { limit: limit.toString() } : {};
      const response = await api.get('/users/match-history', { params });
      setMatchHistory(response.data);
    } catch (error) {
      console.error('Error loading match history:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadProfile(), loadMatchHistory()]);
    setRefreshing(false);
  };

  // ─── Cambiar filtro de resultados ───
  const handleFilterChange = (index: number) => {
    setSelectedResultFilter(index);
    const limit = RESULT_FILTERS[index].value;
    loadMatchHistory(limit || undefined);
  };

  // ─── Logout ───
  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };


  // ─── Navegar a editar perfil ───
  const openEditProfile = () => {
    router.push('/edit-profile' as any);
  };

  // ─── Navegar a editar preferencias ───
  const openEditPreferences = () => {
    router.push('/edit-preferences' as any);
  };

  // ─── Loading state ───
  if (loading && !profile) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#3B5BDB" />
      </View>
    );
  }

  const displayName = profile?.name || user?.name || 'Usuario';
  const displayLocation = profile?.location || user?.location;
  const stats = profile?.stats || {
    matches: 0,
    wins: 0,
    losses: 0,
    followers: 0,
    following: 0,
  };
  const preferences = profile?.preferences || {};
  const sports = profile?.sports || user?.sports || ['Pádel'];

  // Datos del gráfico
  const chartData = matchHistory?.history || [];
  const chartMinRating =
    chartData.length > 0
      ? Math.min(...chartData.map((e) => e.ratingAfter)) - 20
      : 980;
  const chartMaxRating =
    chartData.length > 0
      ? Math.max(...chartData.map((e) => e.ratingAfter)) + 20
      : 1020;
  const chartRange = chartMaxRating - chartMinRating;

  return (
    <ScrollView
      className="flex-1 rounded-t-3xl bg-white"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#3B5BDB"
          colors={['#3B5BDB']}
        />
      }
    >
      {/* ═══ Sección de perfil ═══ */}
      <View className="bg-white px-5 pt-6 pb-5">
        {/* Avatar + Info */}
        <View className="flex-row items-center mb-5">
          <View className="w-16 h-16 rounded-full bg-gray-800 items-center justify-center mr-4">
            <Text className="text-white text-xl font-bold">
              {getInitials(displayName)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">
              {displayName}
            </Text>
            <TouchableOpacity onPress={openEditProfile}>
              <Text className="text-blue-500 text-sm mt-0.5">
                {displayLocation || 'Añadir mi localización'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Estadísticas */}
        <View className="flex-row items-center justify-around mb-5 py-2">
          <View className="items-center flex-1">
            <Text className="text-xl font-bold text-gray-900">
              {stats.matches}
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5">Partidos</Text>
          </View>
          <View className="w-px h-8 bg-gray-200" />
          <View className="items-center flex-1">
            <Text className="text-xl font-bold text-gray-900">
              {stats.followers}
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5">Seguidores</Text>
          </View>
          <View className="w-px h-8 bg-gray-200" />
          <View className="items-center flex-1">
            <Text className="text-xl font-bold text-gray-900">
              {stats.following}
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5">Seguidos</Text>
          </View>
        </View>

        {/* Botón Editar perfil */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 border border-blue-500 rounded-full py-2.5 items-center"
            onPress={openEditProfile}
          >
            <Text className="text-blue-500 font-semibold text-sm">
              Editar perfil
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══ Evolución del nivel ═══ */}
      <View className="px-5 pt-4 pb-2 bg-white">
        <Text className="text-lg font-bold text-gray-900 mb-1">
          Evolución del nivel
        </Text>

        {/* Rating actual */}
        {matchHistory && (
          <View className="flex-row items-center mb-3">
            <Text className="text-2xl font-bold text-blue-600">
              {matchHistory.currentRating}
            </Text>
            <Text className="text-xs text-gray-500 ml-2">
              Rating · {matchHistory.wins}V {matchHistory.losses}D
              {matchHistory.draws > 0 ? ` ${matchHistory.draws}E` : ''}
            </Text>
          </View>
        )}

        {/* Filtros */}
        <View className="flex-row gap-2 mb-4">
          {RESULT_FILTERS.map((filter, index) => (
            <TouchableOpacity
              key={filter.label}
              onPress={() => handleFilterChange(index)}
              className={`px-3 py-1.5 rounded-full ${selectedResultFilter === index
                ? 'bg-green-600'
                : 'bg-gray-100 border border-gray-200'
                }`}
            >
              <Text
                className={`text-xs font-medium ${selectedResultFilter === index
                  ? 'text-white'
                  : 'text-gray-600'
                  }`}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Gráfico */}
        <View className="bg-gray-50 rounded-2xl p-4">
          {chartData.length > 0 ? (
            <View>
              <View className="h-36 flex-row items-end px-1">
                {chartData.map((entry) => (
                  <RatingBar
                    key={entry.matchId}
                    entry={entry}
                    maxHeight={120}
                    minRating={chartMinRating}
                    ratingRange={chartRange}
                  />
                ))}
              </View>
              {/* Leyenda */}
              <View className="flex-row justify-center gap-4 mt-3 pt-3 border-t border-gray-100">
                <View className="flex-row items-center">
                  <View className="w-3 h-3 rounded-full bg-green-500 mr-1" />
                  <Text className="text-xs text-gray-500">Victoria</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-3 h-3 rounded-full bg-red-400 mr-1" />
                  <Text className="text-xs text-gray-500">Derrota</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-3 h-3 rounded-full bg-amber-400 mr-1" />
                  <Text className="text-xs text-gray-500">Empate</Text>
                </View>
              </View>
            </View>
          ) : (
            <View className="items-center py-4">
              {/* Gráfico placeholder */}
              <View className="h-28 flex-row items-end px-2 w-full mb-4">
                {[8, 14, 16, 20, 24, 32].map((h, i) => (
                  <View key={i} className="flex-1 items-center">
                    <View
                      className={`w-2 rounded-full ${['bg-blue-200', 'bg-blue-300', 'bg-blue-300', 'bg-blue-400', 'bg-blue-500', 'bg-blue-600'][i]
                        }`}
                      style={{ height: h }}
                    />
                  </View>
                ))}
              </View>

              <View className="items-center pt-4 border-t border-gray-100 w-full">
                <Text className="text-base font-bold text-gray-900 mb-1">
                  Mide tu progreso
                </Text>
                <Text className="text-sm text-gray-500 text-center mb-3">
                  Juega partidos para empezar a medir tu evolución
                </Text>
                <TouchableOpacity
                  className="bg-gray-900 rounded-full px-6 py-3"
                  onPress={() => router.push('/matchmaking')}
                >
                  <Text className="text-white font-bold text-sm">
                    Buscar partido
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* ═══ Preferencias de jugador ═══ */}
      <View className="px-5 pt-6 pb-3">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-lg font-bold text-gray-900">
            Preferencias de jugador
          </Text>
          <TouchableOpacity onPress={openEditPreferences}>
            <Text className="text-blue-500 font-semibold text-sm">
              Editar
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mano preferida */}
        <TouchableOpacity
          className="bg-gray-50 rounded-xl px-4 py-3.5 mb-3 flex-row items-center justify-between"
          onPress={openEditPreferences}
        >
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full bg-orange-50 items-center justify-center mr-3">
              <Ionicons name="hand-left-outline" size={20} color="#f97316" />
            </View>
            <View>
              <Text className="text-xs text-gray-500">Mano preferida</Text>
              <Text className="text-sm font-semibold text-gray-900 mt-0.5">
                {preferences.preferredHand || 'Sin definir'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>

        {/* Posición en pista */}
        <TouchableOpacity
          className="bg-gray-50 rounded-xl px-4 py-3.5 mb-3 flex-row items-center justify-between"
          onPress={openEditPreferences}
        >
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full bg-red-50 items-center justify-center mr-3">
              <Ionicons name="location-outline" size={20} color="#ef4444" />
            </View>
            <View>
              <Text className="text-xs text-gray-500">Posición en pista</Text>
              <Text className="text-sm font-semibold text-gray-900 mt-0.5">
                {preferences.courtPosition || 'Sin definir'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>

        {/* Tipo de partido */}
        <TouchableOpacity
          className="bg-gray-50 rounded-xl px-4 py-3.5 mb-3 flex-row items-center justify-between"
          onPress={openEditPreferences}
        >
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full bg-amber-50 items-center justify-center mr-3">
              <Ionicons name="trophy-outline" size={20} color="#f59e0b" />
            </View>
            <View>
              <Text className="text-xs text-gray-500">Tipo de partido</Text>
              <Text className="text-sm font-semibold text-gray-900 mt-0.5">
                {preferences.matchType || 'Sin definir'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>

        {/* Horario de juego preferido */}
        <TouchableOpacity
          className="bg-gray-50 rounded-xl px-4 py-3.5 mb-3 flex-row items-center justify-between"
          onPress={openEditPreferences}
        >
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full bg-orange-50 items-center justify-center mr-3">
              <Ionicons name="sunny-outline" size={20} color="#f97316" />
            </View>
            <View>
              <Text className="text-xs text-gray-500">
                Horario de juego preferido
              </Text>
              <Text className="text-sm font-semibold text-gray-900 mt-0.5">
                {preferences.preferredPlayTime || 'Sin definir'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* ═══ Ajustes ═══ */}
      <View className="px-5 pt-6 pb-3">
        <Text className="text-lg font-bold text-gray-900 mb-4">
          Ajustes
        </Text>

        {/* Configurar Disponibilidad */}
        <TouchableOpacity
          className="bg-gray-50 rounded-xl px-4 py-3.5 mb-3 flex-row items-center justify-between"
          onPress={() => router.push('/availability')}
        >
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-3">
              <Ionicons name="calendar-outline" size={20} color="#3B5BDB" />
            </View>
            <View>
              <Text className="text-sm font-semibold text-gray-900">
                Configurar disponibilidad
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                Horarios en los que podés jugar
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>

        {/* Buscar partido */}
        <TouchableOpacity
          className="bg-gray-50 rounded-xl px-4 py-3.5 mb-3 flex-row items-center justify-between"
          onPress={() => router.push('/matchmaking')}
        >
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full bg-green-50 items-center justify-center mr-3">
              <Ionicons name="search-outline" size={20} color="#22c55e" />
            </View>
            <View>
              <Text className="text-sm font-semibold text-gray-900">
                Buscar partido
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                Encontrá jugadores para tu próximo partido
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      {/* ═══ Cerrar sesión ═══ */}
      <View className="px-5 pt-2 pb-10">
        <TouchableOpacity
          className="bg-gray-50 rounded-xl px-4 py-3.5 flex-row items-center"
          onPress={handleLogout}
        >
          <View className="w-10 h-10 rounded-full bg-red-50 items-center justify-center mr-3">
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </View>
          <Text className="text-sm font-semibold text-red-500">
            Cerrar sesión
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
