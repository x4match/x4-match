import { Image, View } from 'react-native';

const BRAND_MARK = require('../../assets/figma/shared/x4match-degrade.png');

/** Outer box aligned to Figma wordmark (~114×14 scaled up for readability). */
export const MESSAGES_BRAND_MARK_SIZE = { width: 168, height: 22 } as const;

type MessagesBrandMarkProps = {
  width?: number;
  height?: number;
};

/** X4MATCH wordmark watermark from Figma export (messages-brand-mark.png). */
export function MessagesBrandMark({
  width = MESSAGES_BRAND_MARK_SIZE.width,
  height = MESSAGES_BRAND_MARK_SIZE.height,
}: MessagesBrandMarkProps) {
  return (
    <View
      accessibilityLabel="x4 match"
      style={{ width, height, alignItems: 'center', justifyContent: 'center' }}
    >
      <Image
        source={BRAND_MARK}
        style={{ width, height }}
        resizeMode="contain"
      />
    </View>
  );
}
