import { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

function getMedalIcon(position: number) {
  switch (position) {
    case 1:
      return { icon: 'medal' as const, color: '#f59e0b', bg: 'bg-amber-50' };
    case 2:
      return { icon: 'medal' as const, color: '#9ca3af', bg: 'bg-gray-50' };
    case 3:
      return { icon: 'medal' as const, color: '#d97706', bg: 'bg-orange-50' };
    default:
      return null;
  }
}

export default function RankingsScreen() {
  const [clubId, setClubId] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const { data: clubs } = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      const res = await api.get('/clubs');
      return res.data;
    },
  });

  const { data: ranking, isLoading, refetch } = useQuery({
    queryKey: ['weekly-ranking', clubId, category],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (clubId) params.append('clubId', clubId);
      if (category) params.append('category', category);
      const res = await api.get(`/rankings/weekly?${params.toString()}`);
      return res.data;
    },
  });

  const categories = ['', 'A', 'B', 'C'];
  const activeFilters = (clubId ? 1 : 0) + (category ? 1 : 0);

  return (
    <ScrollView
      className="flex-1 rounded-t-3xl bg-white"
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      {/* ═══ Header ═══ */}
      <View className="px-5 pt-6 pb-2">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-lg font-bold text-gray-900">Ranking Semanal</Text>
          <TouchableOpacity
            className={`flex-row items-center px-3 py-1.5 rounded-full ${showFilters ? 'bg-gray-900' : 'bg-gray-50'}`}
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={14} color={showFilters ? '#fff' : '#374151'} />
            <Text className={`text-xs font-semibold ml-1.5 ${showFilters ? 'text-white' : 'text-gray-700'}`}>
              Filtros
            </Text>
            {activeFilters > 0 && (
              <View className="bg-amber-400 w-4 h-4 rounded-full items-center justify-center ml-1.5">
                <Text className="text-[9px] font-bold text-gray-900">{activeFilters}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-gray-500">
          {ranking?.length ?? 0} jugadores
        </Text>
      </View>

      {/* ═══ Filtros colapsables ═══ */}
      {showFilters && (
        <View className="px-5 pt-4 pb-2">
          {/* Club filter */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Club</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className={`px-3 py-1.5 rounded-full ${!clubId ? 'bg-gray-900' : 'bg-gray-50'}`}
                  onPress={() => setClubId('')}
                >
                  <Text className={`text-xs font-medium ${!clubId ? 'text-white' : 'text-gray-600'}`}>
                    Todos
                  </Text>
                </TouchableOpacity>
                {clubs?.map((club: any) => (
                  <TouchableOpacity
                    key={club.id}
                    className={`px-3 py-1.5 rounded-full ${clubId === club.id ? 'bg-gray-900' : 'bg-gray-50'}`}
                    onPress={() => setClubId(clubId === club.id ? '' : club.id)}
                  >
                    <Text className={`text-xs font-medium ${clubId === club.id ? 'text-white' : 'text-gray-600'}`} numberOfLines={1}>
                      {club.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Categoría filter */}
          <View className="mb-3">
            <Text className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Categoría</Text>
            <View className="flex-row gap-2">
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat || 'all'}
                  className={`px-3 py-1.5 rounded-full ${category === cat ? 'bg-gray-900' : 'bg-gray-50'}`}
                  onPress={() => setCategory(cat)}
                >
                  <Text className={`text-xs font-medium ${category === cat ? 'text-white' : 'text-gray-600'}`}>
                    {cat || 'Todas'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* ═══ Ranking list ═══ */}
      <View className="px-5 pt-4 pb-10">
        {isLoading ? (
          <View className="items-center py-12">
            <Text className="text-sm text-gray-400">Cargando ranking...</Text>
          </View>
        ) : ranking?.length === 0 ? (
          <View className="items-center py-16">
            <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mb-4">
              <Ionicons name="trophy-outline" size={24} color="#9ca3af" />
            </View>
            <Text className="text-sm font-semibold text-gray-900 mb-1">
              Sin datos disponibles
            </Text>
            <Text className="text-xs text-gray-500 text-center">
              No hay ranking para los filtros seleccionados
            </Text>
          </View>
        ) : (
          ranking?.map((entry: any, index: number) => {
            const medal = getMedalIcon(entry.position);
            const isTopThree = entry.position <= 3;

            return (
              <View
                key={entry.userId}
                className={`flex-row items-center rounded-xl px-4 py-3.5 mb-2 ${isTopThree ? 'bg-gray-50' : ''}`}
              >
                {/* Posición */}
                <View className="w-8 items-center mr-3">
                  {medal ? (
                    <View className={`w-8 h-8 rounded-full ${medal.bg} items-center justify-center`}>
                      <Ionicons name={medal.icon} size={16} color={medal.color} />
                    </View>
                  ) : (
                    <Text className="text-sm font-semibold text-gray-400">{entry.position}</Text>
                  )}
                </View>

                {/* Avatar con inicial */}
                <View className="w-9 h-9 rounded-full bg-gray-800 items-center justify-center mr-3">
                  <Text className="text-white text-xs font-bold">
                    {entry.name?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>

                {/* Nombre + Rating */}
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                    {entry.name}
                  </Text>
                  <View className="flex-row items-center mt-0.5">
                    <Ionicons name="star" size={10} color="#f59e0b" />
                    <Text className="text-[10px] text-gray-500 ml-1">
                      Rating {entry.rating}
                    </Text>
                  </View>
                </View>

                {/* Puntos */}
                <View className="items-end">
                  <Text className="text-sm font-bold text-gray-900">{entry.points}</Text>
                  <Text className="text-[10px] text-gray-400">pts</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

