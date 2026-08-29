import { View, Text, Image, ImageStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const border = borderColor ? { borderWidth: 2, borderColor } : { borderWidth: 1, borderColor: ui.colors.borderStrong };

  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={[
          {
            width: dim.box,
            height: dim.box,
            borderRadius: dim.box / 2,
            backgroundColor: ui.colors.surface2,
          },
          border,
          style,
        ]}
      />
    );
  }

  return (
    <LinearGradient
      colors={[ui.colors.primary, ui.colors.primaryDark]}
      style={[
        {
          width: dim.box,
          height: dim.box,
          borderRadius: dim.box / 2,
          alignItems: 'center',
          justifyContent: 'center',
        },
        border,
        style as any,
      ]}
    >
      <Text style={{ color: ui.colors.onPrimary, fontFamily: ui.typography.label.fontFamily, fontSize: dim.font }}>
        {getInitials(name)}
      </Text>
    </LinearGradient>
  );
}
