import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'CONFIRMED':
      return { label: 'Confirmado', bg: 'bg-green-50', text: 'text-green-600', icon: 'checkmark-circle' as const, iconColor: '#16a34a' };
    case 'PENDING':
      return { label: 'Pendiente', bg: 'bg-amber-50', text: 'text-amber-600', icon: 'time' as const, iconColor: '#d97706' };
    default:
      return { label: status, bg: 'bg-gray-100', text: 'text-gray-500', icon: 'ellipse' as const, iconColor: '#6b7280' };
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const { data: matches, isLoading, refetch } = useQuery({
    queryKey: ['my-matches'],
    queryFn: async () => {
      const res = await api.get('/matches/me');
      return res.data;
    },
  });

  const upcomingMatches = matches?.filter(
    (m: any) => m.status === 'PENDING' || m.status === 'CONFIRMED'
  ) || [];

  const displayName = user?.name || 'Usuario';

  return (
    <ScrollView
      className="flex-1 rounded-t-3xl bg-white"
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      {/* ═══ Header con avatar ═══ */}
      <View className="px-5 pt-6 pb-5">
        <View className="flex-row items-center mb-1">
          <View className="w-11 h-11 rounded-full bg-gray-800 items-center justify-center mr-3">
            <Text className="text-white text-sm font-bold">
              {getInitials(displayName)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500">Bienvenido</Text>
            <Text className="text-lg font-bold text-gray-900">{displayName}</Text>
          </View>
          <View className="flex-row items-center bg-gray-50 px-3 py-1.5 rounded-full">
            <Ionicons name="star" size={12} color="#f59e0b" />
            <Text className="text-xs font-semibold text-gray-700 ml-1">{user?.rating}</Text>
          </View>
        </View>
      </View>

      {/* ═══ Acciones rápidas ═══ */}
      <View className="px-5 pb-5">
        <TouchableOpacity
          className="bg-gray-900 rounded-xl py-4 px-5 flex-row items-center justify-center"
          onPress={() => router.push('/matchmaking' as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="flash" size={18} color="#fbbf24" />
          <Text className="text-white font-semibold text-sm ml-2">
            Buscar Partido
          </Text>
        </TouchableOpacity>

        {/* Accesos rápidos secundarios */}
        <View className="flex-row gap-3 mt-3">
          <TouchableOpacity
            className="flex-1 bg-gray-50 rounded-xl py-3.5 px-4 flex-row items-center justify-center"
            onPress={() => router.navigate('/(tabs)/clubs' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="business-outline" size={16} color="#374151" />
            <Text className="text-xs font-semibold text-gray-700 ml-2">Clubs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-gray-50 rounded-xl py-3.5 px-4 flex-row items-center justify-center"
            onPress={() => router.navigate('/(tabs)/rankings' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="trophy-outline" size={16} color="#374151" />
            <Text className="text-xs font-semibold text-gray-700 ml-2">Rankings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ═══ Próximos Partidos ═══ */}
      <View className="px-5 pt-4 pb-10">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-bold text-gray-900">Próximos Partidos</Text>
          {upcomingMatches.length > 0 && (
            <View className="bg-gray-900 w-6 h-6 rounded-full items-center justify-center">
              <Text className="text-white text-[10px] font-bold">{upcomingMatches.length}</Text>
            </View>
          )}
        </View>

        {isLoading ? (
          <View className="items-center py-12">
            <Text className="text-sm text-gray-400">Cargando...</Text>
          </View>
        ) : upcomingMatches.length === 0 ? (
          <View className="items-center py-16">
            <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mb-4">
              <Ionicons name="tennisball-outline" size={24} color="#9ca3af" />
            </View>
            <Text className="text-sm font-semibold text-gray-900 mb-1">
              Sin partidos próximos
            </Text>
            <Text className="text-xs text-gray-500 text-center mb-4">
              Buscá un partido y empezá a jugar
            </Text>
            <TouchableOpacity
              className="bg-gray-900 rounded-full px-6 py-3"
              onPress={() => router.push('/matchmaking' as any)}
            >
              <Text className="text-white font-bold text-xs">Buscar partido</Text>
            </TouchableOpacity>
          </View>
        ) : (
          upcomingMatches.map((match: any) => {
            const status = getStatusConfig(match.status);
            const matchDate = new Date(match.date);
            const dayName = matchDate.toLocaleDateString('es-AR', { weekday: 'short' });
            const dayNum = matchDate.getDate();
            const month = matchDate.toLocaleDateString('es-AR', { month: 'short' });

            return (
              <TouchableOpacity
                key={match.id}
                className="bg-gray-50 rounded-xl px-4 py-4 mb-3"
                onPress={() => router.push(`/match/${match.id}`)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-start">
                  {/* Fecha compacta */}
                  <View className="w-12 h-12 rounded-xl bg-white items-center justify-center mr-3">
                    <Text className="text-[10px] text-gray-400 uppercase">{dayName}</Text>
                    <Text className="text-base font-bold text-gray-900 -mt-0.5">{dayNum}</Text>
                    <Text className="text-[9px] text-gray-400 uppercase -mt-0.5">{month}</Text>
                  </View>

                  {/* Contenido */}
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between mb-1">
                      <View className="flex-row items-center">
                        <Ionicons name="time-outline" size={12} color="#9ca3af" />
                        <Text className="text-sm font-semibold text-gray-900 ml-1">
                          {match.startHour}:00 - {match.endHour}:00
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                    </View>

                    {match.club && (
                      <View className="flex-row items-center mb-2">
                        <Ionicons name="location-outline" size={11} color="#9ca3af" />
                        <Text className="text-xs text-gray-500 ml-1" numberOfLines={1}>
                          {match.club.name}
                        </Text>
                      </View>
                    )}

                    <View className="flex-row items-center gap-2">
                      <View className={`flex-row items-center px-2.5 py-1 rounded-full ${status.bg}`}>
                        <Ionicons name={status.icon} size={10} color={status.iconColor} />
                        <Text className={`text-[10px] font-semibold ml-1 ${status.text}`}>
                          {status.label}
                        </Text>
                      </View>
                      {match.bonusPointsApplied > 0 && (
                        <View className="flex-row items-center">
                          <Ionicons name="sparkles" size={10} color="#d97706" />
                          <Text className="text-[10px] text-amber-600 font-medium ml-0.5">
                            +{match.bonusPointsApplied} bonus
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}
