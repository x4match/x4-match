import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

export default function ClubsScreen() {
  const router = useRouter();

  const { data: clubs, isLoading, refetch } = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      const res = await api.get('/clubs');
      return res.data;
    },
  });

  return (
    <ScrollView
      className="flex-1 rounded-t-3xl bg-white"
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      <View className="px-5 pt-6 pb-4">
        <Text className="text-lg font-bold text-gray-900 mb-1">Clubs</Text>
        <Text className="text-xs text-gray-500">
          {clubs?.length ?? 0} disponibles
        </Text>
      </View>

      <View className="px-5 pb-10">
        {isLoading ? (
          <View className="items-center py-12">
            <Text className="text-sm text-gray-400">Cargando...</Text>
          </View>
        ) : clubs?.length === 0 ? (
          <View className="items-center py-16">
            <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mb-4">
              <Ionicons name="location-outline" size={24} color="#9ca3af" />
            </View>
            <Text className="text-sm font-semibold text-gray-900 mb-1">
              Sin clubs disponibles
            </Text>
            <Text className="text-xs text-gray-500 text-center">
              No hay clubs registrados por el momento
            </Text>
          </View>
        ) : (
          clubs?.map((club: any, index: number) => (
            <TouchableOpacity
              key={club.id}
              className={`bg-gray-50 rounded-xl px-4 py-4 mb-3`}
              onPress={() => router.push(`/club/${club.id}`)}
              activeOpacity={0.7}
            >
              <View className="flex-row items-start">
                {/* Icono del club */}
                <View className="w-10 h-10 rounded-full bg-white items-center justify-center mr-3 mt-0.5">
                  <Ionicons name="business-outline" size={18} color="#374151" />
                </View>

                {/* Contenido */}
                <View className="flex-1">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-sm font-semibold text-gray-900 flex-1" numberOfLines={1}>
                      {club.name}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                  </View>

                  <View className="flex-row items-center mb-2">
                    <Ionicons name="location-outline" size={12} color="#9ca3af" />
                    <Text className="text-xs text-gray-500 ml-1 flex-1" numberOfLines={1}>
                      {club.address}
                    </Text>
                  </View>

                  {club.description && (
                    <Text className="text-xs text-gray-400 mb-2.5" numberOfLines={2}>
                      {club.description}
                    </Text>
                  )}

                  {/* Badges */}
                  <View className="flex-row items-center gap-2">
                    <View
                      className={`px-2.5 py-1 rounded-full ${club.plan === 'PLUS' ? 'bg-blue-50' : 'bg-gray-100'
                        }`}
                    >
                      <Text
                        className={`text-[10px] font-semibold tracking-wide ${club.plan === 'PLUS' ? 'text-blue-600' : 'text-gray-500'
                          }`}
                      >
                        {club.plan}
                      </Text>
                    </View>
                    {club._count?.courts > 0 && (
                      <View className="flex-row items-center">
                        <Ionicons name="grid-outline" size={10} color="#9ca3af" />
                        <Text className="text-[10px] text-gray-500 ml-1">
                          {club._count.courts} {club._count.courts === 1 ? 'cancha' : 'canchas'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}
