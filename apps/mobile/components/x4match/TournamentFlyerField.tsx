import { Image, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '@/theme/tokens';
import { PrimaryButton } from '@/components/ui';
import { FLYER_ASPECT_RATIO, FLYER_HINT } from '@/lib/tournament/flyer';

type TournamentFlyerFieldProps = {
  previewUri?: string | null;
  loading?: boolean;
  onPress: () => void;
  onClear?: () => void;
  optional?: boolean;
};

export function TournamentFlyerField({
  previewUri,
  loading,
  onPress,
  onClear,
  optional = true,
}: TournamentFlyerFieldProps) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, fontWeight: '600', marginBottom: 8 }}>
        Flyer{optional ? ' (opcional)' : ''}
      </Text>

      {previewUri ? (
        <View>
          <TouchableOpacity onPress={onPress} activeOpacity={0.85} disabled={loading}>
            <View
              style={{
                width: '100%',
                aspectRatio: FLYER_ASPECT_RATIO,
                borderRadius: ui.radius.md,
                overflow: 'hidden',
                backgroundColor: ui.colors.cardMuted,
                borderWidth: 1,
                borderColor: ui.colors.border,
              }}
            >
              <Image
                source={{ uri: previewUri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
              {loading ? (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    backgroundColor: ui.colors.overlay,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator color={ui.colors.primary} />
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label="Cambiar"
                size="sm"
                variant="outline"
                fullWidth
                onPress={onPress}
                disabled={loading}
              />
            </View>
            {onClear ? (
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  label="Quitar"
                  size="sm"
                  variant="ghost"
                  fullWidth
                  onPress={onClear}
                  disabled={loading}
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onPress}
          disabled={loading}
          activeOpacity={0.85}
          style={{
            width: '100%',
            aspectRatio: FLYER_ASPECT_RATIO,
            borderWidth: 1,
            borderColor: ui.colors.border,
            borderStyle: 'dashed',
            borderRadius: ui.radius.md,
            backgroundColor: ui.colors.cardMuted,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: 20,
          }}
        >
          {loading ? (
            <ActivityIndicator color={ui.colors.primary} />
          ) : (
            <>
              <Ionicons name="image-outline" size={28} color={ui.colors.primary} />
              <Text style={{ color: ui.colors.textPrimary, fontWeight: '600' }}>Agregar flyer</Text>
              <Text style={{ color: ui.colors.textMuted, fontSize: 12, textAlign: 'center' }}>
                Afiche horizontal{'\n'}
                {FLYER_HINT}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
