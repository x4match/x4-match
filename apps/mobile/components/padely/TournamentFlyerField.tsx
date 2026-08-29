import { Image, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '@/theme/tokens';
import { PrimaryButton } from '@/components/ui';

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
      <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginBottom: 8, fontWeight: '600' }}>
        Flyer{optional ? ' (opcional)' : ''}
      </Text>
      {previewUri ? (
        <View>
          <TouchableOpacity onPress={onPress} activeOpacity={0.85} disabled={loading}>
            <Image
              source={{ uri: previewUri }}
              style={{
                width: '100%',
                height: 220,
                borderRadius: ui.radius.md,
                backgroundColor: ui.colors.cardMuted,
              }}
              resizeMode="cover"
            />
            {loading ? (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  borderRadius: ui.radius.md,
                  backgroundColor: ui.colors.overlay,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ActivityIndicator color={ui.colors.primary} />
              </View>
            ) : null}
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Cambiar" size="sm" variant="outline" fullWidth onPress={onPress} disabled={loading} />
            </View>
            {onClear ? (
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Quitar" size="sm" variant="ghost" fullWidth onPress={onClear} disabled={loading} />
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
            borderWidth: 1,
            borderColor: ui.colors.border,
            borderStyle: 'dashed',
            borderRadius: ui.radius.md,
            backgroundColor: ui.colors.cardMuted,
            paddingVertical: 28,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? (
            <ActivityIndicator color={ui.colors.primary} />
          ) : (
            <>
              <Ionicons name="image-outline" size={28} color={ui.colors.primary} />
              <Text style={{ color: ui.colors.textPrimary, fontWeight: '600' }}>Agregar flyer</Text>
              <Text style={{ color: ui.colors.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: 24 }}>
                Foto o diseño que hayan hecho los organizadores
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
