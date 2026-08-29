import { useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';
import { ui } from '@/theme/tokens';
import { AppCard, Avatar, PrimaryButton, SectionHeader } from '@/components/padely';

export interface ClubComment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  user_name: string;
  nickname?: string;
  photo_url?: string;
}

type ClubCommentsSectionProps = {
  clubId: string;
  canPost: boolean;
};

export function ClubCommentsSection({ clubId, canPost }: ClubCommentsSectionProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');

  const { data: comments, isLoading } = useQuery({
    queryKey: ['club-comments', clubId],
    queryFn: async () => {
      const res = await api.get(`/clubs/${clubId}/comments`);
      return res.data as ClubComment[];
    },
    enabled: !!clubId,
  });

  const postMutation = useMutation({
    mutationFn: async (body: string) => {
      const res = await api.post(`/clubs/${clubId}/comments`, { body });
      return res.data;
    },
    onSuccess: () => {
      setText('');
      queryClient.invalidateQueries({ queryKey: ['club-comments', clubId] });
    },
    onError: (err: any) => {
      Alert.alert('Error', err.response?.data?.message || 'No se pudo publicar el comentario');
    },
  });

  const handlePost = () => {
    const body = text.trim();
    if (!body) return;
    postMutation.mutate(body);
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <SectionHeader title="Comentarios" subtitle="Opiniones de jugadores" dark />

      {canPost && (
        <AppCard style={{ marginBottom: 12 }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Contá tu experiencia en este club..."
            placeholderTextColor={ui.colors.textMuted}
            multiline
            maxLength={1000}
            style={{
              minHeight: 72,
              color: ui.colors.textPrimary,
              fontSize: 14,
              textAlignVertical: 'top',
              marginBottom: 12,
            }}
          />
          <PrimaryButton
            label={postMutation.isPending ? 'Publicando...' : 'Publicar comentario'}
            size="sm"
            fullWidth
            disabled={!text.trim() || postMutation.isPending}
            onPress={handlePost}
            icon={<Ionicons name="send" size={16} color="#fff" />}
          />
        </AppCard>
      )}

      {isLoading ? (
        <ActivityIndicator color={ui.colors.primary} style={{ marginVertical: 16 }} />
      ) : !comments?.length ? (
        <AppCard>
          <Text style={{ color: ui.colors.textSecondary, fontSize: 13 }}>
            {canPost
              ? 'Sé el primero en dejar un comentario sobre este club.'
              : 'Todavía no hay comentarios.'}
          </Text>
        </AppCard>
      ) : (
        comments.map((comment) => (
          <AppCard key={comment.id} padding="sm" style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Avatar
                name={comment.nickname || comment.user_name}
                photo={comment.photo_url}
                size="sm"
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, flex: 1 }}>
                    {comment.nickname || comment.user_name}
                  </Text>
                  <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>
                    {formatRelativeTime(comment.created_at)}
                  </Text>
                </View>
                <Text style={{ color: ui.colors.textSecondary, fontSize: 14, marginTop: 6, lineHeight: 20 }}>
                  {comment.body}
                </Text>
              </View>
            </View>
          </AppCard>
        ))
      )}
    </View>
  );
}
