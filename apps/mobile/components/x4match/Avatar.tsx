import { View, Text, Image, ImageStyle, StyleProp } from 'react-native';
import { getInitials } from '@/lib/format';
import { ui } from '@/theme/tokens';

const SIZES = {
  sm: { box: 32, font: 11 },
  md: { box: 40, font: 13 },
  lg: { box: 56, font: 16 },
  xl: { box: 80, font: 22 },
};

type AvatarProps = {
  name: string;
  photo?: string | null;
  size?: keyof typeof SIZES;
  style?: StyleProp<ImageStyle>;
  borderColor?: string;
};

export function Avatar({ name, photo, size = 'md', style, borderColor }: AvatarProps) {
  const dim = SIZES[size];
  const border = borderColor ? { borderWidth: 2, borderColor } : {};

  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={[
          {
            width: dim.box,
            height: dim.box,
            borderRadius: dim.box / 2,
            backgroundColor: ui.colors.surfaceAlt,
          },
          border,
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: dim.box,
          height: dim.box,
          borderRadius: dim.box / 2,
          backgroundColor: ui.colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        border,
        style,
      ]}
    >
      <Text style={{ color: ui.colors.onPrimary, fontWeight: '700', fontSize: dim.font }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}
