import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: club, isLoading } = useQuery({
    queryKey: ['club', id],
    queryFn: async () => {
      const res = await api.get(`/clubs/${id}`);
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Cargando...</Text>
      </View>
    );
  }

  if (!club) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Club no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-4 py-6">
        <Text className="text-2xl font-bold mb-4">{club.name}</Text>
        <Text className="text-gray-600 mb-4">{club.address}</Text>
        {club.description && (
          <Text className="text-gray-600 mb-4">{club.description}</Text>
        )}

        <View className="bg-white rounded-lg p-4 mb-4">
          <Text className="font-semibold mb-2">Canchas</Text>
          {club.courts?.map((court: any) => (
            <Text key={court.id} className="text-gray-600">
              {court.name} - {court.surface}
            </Text>
          ))}
        </View>

        {club.promotions && club.promotions.length > 0 && (
          <View className="bg-white rounded-lg p-4">
            <Text className="font-semibold mb-2">Promociones</Text>
            {club.promotions.map((promo: any) => (
              <Text key={promo.id} className="text-gray-600">
                {promo.dayOfWeek === 0
                  ? 'Domingo'
                  : promo.dayOfWeek === 1
                  ? 'Lunes'
                  : promo.dayOfWeek === 2
                  ? 'Martes'
                  : promo.dayOfWeek === 3
                  ? 'Miércoles'
                  : promo.dayOfWeek === 4
                  ? 'Jueves'
                  : promo.dayOfWeek === 5
                  ? 'Viernes'
                  : 'Sábado'}{' '}
                {promo.startHour}:00 - {promo.endHour}:00: +{promo.bonusPoints} puntos
              </Text>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

