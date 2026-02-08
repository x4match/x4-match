import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

function getStatusConfig(status: string) {
  switch (status) {
    case 'CONFIRMED':
      return { label: 'Confirmado', bg: 'bg-green-50', text: 'text-green-600', icon: 'checkmark-circle' as const, iconColor: '#16a34a' };
    case 'COMPLETED':
      return { label: 'Finalizado', bg: 'bg-blue-50', text: 'text-blue-600', icon: 'flag' as const, iconColor: '#2563eb' };
    case 'CANCELED':
      return { label: 'Cancelado', bg: 'bg-red-50', text: 'text-red-500', icon: 'close-circle' as const, iconColor: '#ef4444' };
    case 'PENDING':
      return { label: 'Pendiente', bg: 'bg-amber-50', text: 'text-amber-600', icon: 'time' as const, iconColor: '#d97706' };
    default:
      return { label: status, bg: 'bg-gray-100', text: 'text-gray-500', icon: 'ellipse' as const, iconColor: '#6b7280' };
  }
}

export default function MatchesScreen() {
  const router = useRouter();

  const { data: matches, isLoading, refetch } = useQuery({
    queryKey: ['my-matches'],
    queryFn: async () => {
      const res = await api.get('/matches/me');
      return res.data;
    },
  });

  const upcoming = matches?.filter((m: any) => m.status === 'PENDING' || m.status === 'CONFIRMED') || [];
  const past = matches?.filter((m: any) => m.status === 'COMPLETED' || m.status === 'CANCELED') || [];

  return (
    <ScrollView
      className="flex-1 rounded-t-3xl bg-white"
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      {/* ═══ Header ═══ */}
      <View className="px-5 pt-6 pb-4">
        <Text className="text-lg font-bold text-gray-900 mb-1">Mis Partidos</Text>
        <Text className="text-xs text-gray-500">
          {matches?.length ?? 0} en total
        </Text>
      </View>

      <View className="px-5 pb-10">
        {isLoading ? (
          <View className="items-center py-12">
            <Text className="text-sm text-gray-400">Cargando...</Text>
          </View>
        ) : matches?.length === 0 ? (
          <View className="items-center py-16">
            <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mb-4">
              <Ionicons name="tennisball-outline" size={24} color="#9ca3af" />
            </View>
            <Text className="text-sm font-semibold text-gray-900 mb-1">
              Sin partidos aún
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
          <>
            {/* ═══ Próximos ═══ */}
            {upcoming.length > 0 && (
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <Ionicons name="calendar-outline" size={14} color="#374151" />
                  <Text className="text-xs font-semibold text-gray-700 ml-1.5 uppercase tracking-wide">
                    Próximos
                  </Text>
                  <View className="bg-gray-900 w-5 h-5 rounded-full items-center justify-center ml-2">
                    <Text className="text-white text-[9px] font-bold">{upcoming.length}</Text>
                  </View>
                </View>

                {upcoming.map((match: any) => (
                  <MatchCard key={match.id} match={match} router={router} />
                ))}
              </View>
            )}

            {/* ═══ Historial ═══ */}
            {past.length > 0 && (
              <View>
                <View className="flex-row items-center mb-3">
                  <Ionicons name="archive-outline" size={14} color="#374151" />
                  <Text className="text-xs font-semibold text-gray-700 ml-1.5 uppercase tracking-wide">
                    Historial
                  </Text>
                </View>

                {past.map((match: any) => (
                  <MatchCard key={match.id} match={match} router={router} />
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function MatchCard({ match, router }: { match: any; router: any }) {
  const status = getStatusConfig(match.status);
  const matchDate = new Date(match.date);
  const dayName = matchDate.toLocaleDateString('es-AR', { weekday: 'short' });
  const dayNum = matchDate.getDate();
  const month = matchDate.toLocaleDateString('es-AR', { month: 'short' });

  return (
    <TouchableOpacity
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
            {/* Status badge */}
            <View className={`flex-row items-center px-2.5 py-1 rounded-full ${status.bg}`}>
              <Ionicons name={status.icon} size={10} color={status.iconColor} />
              <Text className={`text-[10px] font-semibold ml-1 ${status.text}`}>
                {status.label}
              </Text>
            </View>

            {/* Resultado */}
            {match.result && (
              <View className="flex-row items-center bg-gray-100 px-2.5 py-1 rounded-full">
                <Ionicons name="football-outline" size={10} color="#374151" />
                <Text className="text-[10px] font-bold text-gray-700 ml-1">
                  {match.result.teamAScore} - {match.result.teamBScore}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
