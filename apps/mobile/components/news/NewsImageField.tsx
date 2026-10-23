import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '@/theme/tokens';
import { NEWS_BANNER_ASPECT } from '@/lib/news/api';

type NewsImageFieldProps = {
  previewUri?: string | null;
  onPress: () => void;
};

export function NewsImageField({ previewUri, onPress }: NewsImageFieldProps) {
  return (
    <View style={{ marginBottom: ui.spacing.md }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: ui.colors.textSecondary, marginBottom: 6 }}>
        Imagen del banner
      </Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={previewUri ? 'Cambiar imagen del banner' : 'Elegir imagen del banner'}
        style={{
          width: '100%',
          aspectRatio: NEWS_BANNER_ASPECT,
          borderRadius: ui.radius.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderStyle: previewUri ? 'solid' : 'dashed',
          borderColor: ui.colors.border,
          backgroundColor: ui.colors.surface1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        {previewUri ? (
          <>
            <Image source={{ uri: previewUri }} style={{ position: 'absolute', width: '100%', height: '100%' }} />
            <View
              style={{
                position: 'absolute',
                right: 10,
                bottom: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: 'rgba(0,0,0,0.65)',
                borderRadius: ui.radius.pill,
                paddingHorizontal: 10,
                paddingVertical: 5,
              }}
            >
              <Ionicons name="image-outline" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12 }}>Cambiar</Text>
            </View>
          </>
        ) : (
          <>
            <Ionicons name="image-outline" size={28} color={ui.colors.primary} />
            <Text style={{ color: ui.colors.textPrimary, fontWeight: '600' }}>Elegir imagen</Text>
            <Text style={{ color: ui.colors.textMuted, fontSize: 12 }}>Horizontal, se recorta a 16:7</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
