import { useState } from 'react';
import { ScrollView, Text, View, Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { ui } from '@/theme/tokens';
import { Screen, StackHeader, AppCard, SectionHeader, PrimaryButton, InputField, EmptyState } from '@/components/padely';

export default function ManageClubsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showCreateClub, setShowCreateClub] = useState(false);
  const [clubName, setClubName] = useState('');
  const [clubCity, setClubCity] = useState('');
  const [clubZone, setClubZone] = useState('');

  const canManage = isClub(user?.role);

  const { data: clubs } = useQuery({
    queryKey: ['club-admin-clubs'],
    queryFn: async () => {
      const res = await api.get('/clubs/mine');
      return res.data;
    },
    enabled: canManage,
  });

  const createClub = useMutation({
    mutationFn: async () => {
      const res = await api.post('/clubs', { name: clubName, city: clubCity, zone: clubZone });
      return res.data;
    },
    onSuccess: () => {
      setClubName('');
      setClubCity('');
      setClubZone('');
      setShowCreateClub(false);
      queryClient.invalidateQueries({ queryKey: ['club-admin-clubs'] });
      queryClient.invalidateQueries({ queryKey: ['clubs-mine'] });
      queryClient.invalidateQueries({ queryKey: ['club-profile-clubs'] });
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      Alert.alert('Listo', 'Club creado');
    },
    onError: (err: any) => Alert.alert('Error', err.response?.data?.message || 'No se pudo crear el club'),
  });

  if (!canManage) {
    return (
      <Screen>
        <StackHeader title="Mis clubs" />
        <EmptyState
          icon={<Ionicons name="shield-outline" size={32} color={ui.colors.textMuted} />}
          title="Acceso restringido"
          description="Esta sección es solo para cuentas de club."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <StackHeader title="Mis clubs" />
      <ScrollView contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 32 }}>
        {showCreateClub ? (
          <AppCard>
            <Text style={{ fontWeight: '700', fontSize: 16, color: ui.colors.textPrimary, marginBottom: 12 }}>
              Crear nuevo club
            </Text>
            <InputField label="Nombre" value={clubName} onChangeText={setClubName} placeholder="Palermo Pádel Club" />
            <InputField label="Ciudad" value={clubCity} onChangeText={setClubCity} />
            <InputField label="Zona" value={clubZone} onChangeText={setClubZone} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Cancelar" variant="ghost" fullWidth onPress={() => setShowCreateClub(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Crear" fullWidth loading={createClub.isPending} onPress={() => createClub.mutate()} />
              </View>
            </View>
          </AppCard>
        ) : (
          <PrimaryButton
            label="Crear nuevo club"
            variant="outline"
            fullWidth
            onPress={() => setShowCreateClub(true)}
            style={{ marginBottom: 16 }}
          />
        )}

        <SectionHeader title="Mis clubs" subtitle={`${clubs?.length ?? 0} registrados`} dark />
        {(clubs || []).map((club: any) => (
          <AppCard key={club.id} onPress={() => router.push(`/club/${club.id}` as any)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="business" size={24} color={ui.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{club.name}</Text>
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary }}>
                  {club.city}, {club.zone}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={ui.colors.textMuted} />
            </View>
          </AppCard>
        ))}
      </ScrollView>
    </Screen>
  );
}
