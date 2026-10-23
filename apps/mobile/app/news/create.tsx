import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { ui } from '@/theme/tokens';
import {
  NEWS_QUERY_KEYS,
  createNewsPost,
  fetchNewsSettings,
  newsErrorMessage,
  pickNewsImage,
} from '@/lib/news/api';
import {
  AppCard,
  InputField,
  PressableScale,
  PrimaryButton,
  Screen,
  SelectionChip,
  StackHeader,
} from '@/components/x4match';
import { NewsImageField } from '@/components/news/NewsImageField';

const TITLE_MAX = 80;
const BODY_MAX = 1000;

export default function CreateNewsScreen() {
  const { clubId: presetClubId } = useLocalSearchParams<{ clubId?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isClubAccount = isClub(user?.role);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [clubId, setClubId] = useState<string | null>(presetClubId ?? null);

  const { data: settings } = useQuery({
    queryKey: NEWS_QUERY_KEYS.settings,
    queryFn: fetchNewsSettings,
  });
  const durationDays = settings?.defaultDurationDays ?? 7;

  const { data: myClubs = [] } = useQuery({
    queryKey: ['clubs-mine'],
    queryFn: async () => (await api.get('/clubs/mine')).data as { id: string; name: string }[],
    enabled: isClubAccount,
  });

  useEffect(() => {
    if (isClubAccount && !clubId && myClubs[0]) setClubId(myClubs[0].id);
  }, [isClubAccount, clubId, myClubs]);

  const publishAsClub = isClubAccount && !!clubId;

  const createMutation = useMutation({
    mutationFn: () =>
      createNewsPost({
        imageUri: imageUri!,
        title,
        body,
        linkUrl,
        clubId: publishAsClub ? clubId : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEYS.banners });
      queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEYS.listAll });
      queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEYS.mine });
      if (clubId) queryClient.invalidateQueries({ queryKey: NEWS_QUERY_KEYS.club(clubId) });
      Alert.alert(
        publishAsClub ? 'Noticia publicada' : 'Noticia enviada',
        publishAsClub
          ? `Ya se ve en Novedades durante ${durationDays} días.`
          : 'Un administrador la va a revisar. Te avisamos cuando esté publicada.',
      );
      router.replace((publishAsClub ? `/news/mine?clubId=${clubId}` : '/news/mine') as any);
    },
    onError: (error) => Alert.alert('Error', newsErrorMessage(error, 'No se pudo publicar la noticia')),
  });

  const trimmedTitle = title.trim();
  const canSubmit = !!imageUri && trimmedTitle.length >= 3 && (!isClubAccount || !!clubId);

  return (
    <Screen>
      <StackHeader
        title="Publicar noticia"
        rightAction={
          <PressableScale
            onPress={() => router.push((publishAsClub ? `/news/mine?clubId=${clubId}` : '/news/mine') as any)}
            accessibilityRole="button"
            accessibilityLabel="Ver mis noticias"
          >
            <Text style={{ color: ui.colors.primary, fontSize: 13, fontFamily: ui.typography.label.fontFamily }}>
              Mis noticias
            </Text>
          </PressableScale>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <AppCard style={{ marginBottom: 16 }} padding="sm">
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Ionicons
              name={publishAsClub ? 'flash-outline' : 'shield-checkmark-outline'}
              size={20}
              color={ui.colors.primary}
            />
            <Text style={{ flex: 1, color: ui.colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
              {publishAsClub
                ? `Las noticias del club se publican al instante en Novedades y quedan visibles ${durationDays} días. El equipo de x4 elige cuáles destacar en el carrusel del inicio.`
                : `Tu noticia queda pendiente hasta que un administrador la apruebe. Una vez aprobada se muestra ${durationDays} días en Novedades.`}
            </Text>
          </View>
        </AppCard>

        {isClubAccount && myClubs.length > 1 ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.textSecondary, marginBottom: 8 }}>
              Publicar como
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {myClubs.map((club) => (
                <SelectionChip
                  key={club.id}
                  label={club.name}
                  selected={club.id === clubId}
                  onPress={() => setClubId(club.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <NewsImageField
          previewUri={imageUri}
          onPress={async () => {
            const uri = await pickNewsImage();
            if (uri) setImageUri(uri);
          }}
        />

        <InputField
          label="Título"
          value={title}
          onChangeText={(text) => setTitle(text.slice(0, TITLE_MAX))}
          placeholder="Ej: Torneo suma 12 este sábado"
          hint={`${title.length}/${TITLE_MAX}`}
        />
        <InputField
          label="Descripción (opcional)"
          value={body}
          onChangeText={(text) => setBody(text.slice(0, BODY_MAX))}
          placeholder="Contá los detalles: fecha, lugar, cómo anotarse…"
          multiline
          numberOfLines={5}
          style={{ minHeight: 110, textAlignVertical: 'top' }}
          hint={`${body.length}/${BODY_MAX}`}
        />
        <InputField
          label="Link (opcional)"
          value={linkUrl}
          onChangeText={setLinkUrl}
          placeholder="https://…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <PrimaryButton
          label={publishAsClub ? 'Publicar ahora' : 'Enviar a revisión'}
          fullWidth
          size="lg"
          disabled={!canSubmit}
          loading={createMutation.isPending}
          onPress={() => createMutation.mutate()}
          icon={<Ionicons name="megaphone-outline" size={18} color={ui.colors.onPrimary} />}
        />
      </ScrollView>
    </Screen>
  );
}
