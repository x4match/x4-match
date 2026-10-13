import { useMemo, useState } from 'react';
import { Alert, Image, RefreshControl, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { safeMapCircuit } from '@/lib/mappers';
import { NO_CIRCUIT_ACCESS, apiErrorMessage, hasCircuitPermission } from '@/lib/circuits/staff';
import {
  createCircuitNews,
  deleteCircuitNews,
  fetchCircuitNews,
  pickAndUploadNewsImage,
  updateCircuitNews,
  type CircuitNews,
} from '@/lib/circuits/organizer';
import { ui } from '@/theme/tokens';
import {
  AppCard,
  EmptyState,
  InputField,
  PrimaryButton,
  Screen,
  Sheet,
  StackHeader,
  withCircuitsEnabled,
} from '@/components/x4match';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default withCircuitsEnabled(CircuitNewsScreen);

function CircuitNewsScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const circuitId = Array.isArray(rawId) ? rawId[0] : rawId;
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CircuitNews | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: circuitData } = useQuery({
    queryKey: ['circuit', circuitId],
    queryFn: async () => (await api.get(`/circuits/${circuitId}`)).data,
    enabled: !!circuitId,
  });
  const circuit = useMemo(() => safeMapCircuit(circuitData), [circuitData]);
  const canEdit = hasCircuitPermission(circuit?.viewer ?? NO_CIRCUIT_ACCESS, 'circuit.edit');

  const { data: news = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['circuit-news', circuitId],
    queryFn: () => fetchCircuitNews(circuitId!),
    enabled: !!circuitId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['circuit-news', circuitId] });
    queryClient.invalidateQueries({ queryKey: ['circuit', circuitId] });
  };

  const openEditor = (item: CircuitNews | 'new') => {
    setEditing(item);
    setTitle(item === 'new' ? '' : item.title);
    setBody(item === 'new' ? '' : item.body);
    setPinned(item === 'new' ? false : item.pinned);
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = { title: title.trim(), body: body.trim(), pinned };
      return editing === 'new' || !editing
        ? createCircuitNews(circuitId!, payload)
        : updateCircuitNews(circuitId!, editing.id, payload);
    },
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: (error) => Alert.alert('Error', apiErrorMessage(error, 'No se pudo guardar la noticia')),
  });

  const remove = useMutation({
    mutationFn: (newsId: string) => deleteCircuitNews(circuitId!, newsId),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: (error) => Alert.alert('Error', apiErrorMessage(error, 'No se pudo eliminar')),
  });

  const confirmRemove = (item: CircuitNews) =>
    Alert.alert('Eliminar noticia', `¿Eliminar "${item.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => remove.mutate(item.id) },
    ]);

  return (
    <Screen>
      <StackHeader title="Noticias" />
      <ScrollView
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
      >
        {canEdit ? (
          <PrimaryButton
            label="Publicar noticia"
            fullWidth
            onPress={() => openEditor('new')}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        {isLoading ? (
          <Text style={{ color: ui.colors.textMuted }}>Cargando...</Text>
        ) : news.length === 0 ? (
          <EmptyState
            icon={<Ionicons name="newspaper-outline" size={32} color={ui.colors.textMuted} />}
            title="Sin noticias"
            description="Las novedades del circuito (fechas, cambios de reglamento, resultados) aparecen acá."
          />
        ) : (
          news.map((item) => {
            const open = expanded === item.id;
            return (
              <AppCard key={item.id} style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={{ width: '100%', height: 160 }} resizeMode="cover" />
                ) : null}
                <TouchableOpacity onPress={() => setExpanded(open ? null : item.id)} style={{ padding: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {item.pinned ? <Ionicons name="pin" size={14} color={ui.colors.primary} /> : null}
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: ui.colors.textPrimary }}>
                      {item.title}
                    </Text>
                    {canEdit ? (
                      <TouchableOpacity onPress={() => openEditor(item)} hitSlop={8}>
                        <Ionicons name="create-outline" size={18} color={ui.colors.textSecondary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: 2 }}>
                    {formatDate(item.published_at)}
                    {item.author_name ? ` · ${item.author_name}` : ''}
                  </Text>
                  <Text
                    style={{ fontSize: 14, color: ui.colors.textSecondary, marginTop: 8, lineHeight: 20 }}
                    numberOfLines={open ? undefined : 3}
                  >
                    {item.body}
                  </Text>
                </TouchableOpacity>
              </AppCard>
            );
          })
        )}
      </ScrollView>

      <Sheet
        visible={editing != null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nueva noticia' : 'Editar noticia'}
      >
        <View>
          <InputField label="Título" value={title} onChangeText={setTitle} maxLength={160} />
          <InputField
            label="Texto"
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={5000}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ color: ui.colors.textPrimary, fontWeight: '600' }}>Fijar arriba</Text>
            <Switch value={pinned} onValueChange={setPinned} />
          </View>
          <PrimaryButton
            label="Guardar"
            fullWidth
            loading={save.isPending}
            disabled={!title.trim() || !body.trim() || save.isPending}
            onPress={() => save.mutate()}
          />
          {editing && editing !== 'new' ? (
            <>
              <PrimaryButton
                label="Subir imagen"
                variant="outline"
                fullWidth
                style={{ marginTop: 8 }}
                onPress={async () => {
                  const updated = await pickAndUploadNewsImage(circuitId!, editing.id);
                  if (updated) invalidate();
                }}
              />
              <PrimaryButton
                label="Eliminar"
                variant="ghost"
                fullWidth
                style={{ marginTop: 8 }}
                loading={remove.isPending}
                onPress={() => confirmRemove(editing)}
              />
            </>
          ) : null}
        </View>
      </Sheet>
    </Screen>
  );
}
