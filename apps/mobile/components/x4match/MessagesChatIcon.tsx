import { Image, View } from 'react-native';

const CHAT_ICON = require('../../assets/figma/messages-chat-icon.png');

/** Outer asset box from Figma node 106109:787 (26.96 × 23). */
export const MESSAGES_CHAT_ICON_SIZE = { width: 27, height: 23 } as const;

type MessagesChatIconProps = {
  width?: number;
  height?: number;
};

/**
 * Chat empty-state icon from Figma (bubble + ellipsis).
 * PNG — same reliable path as MatchesCalendarIcon / MessagesBrandMark
 * (RN SVG gradients/complex paths were blank or broken on device).
 */
export function MessagesChatIcon({
  width = MESSAGES_CHAT_ICON_SIZE.width,
  height = MESSAGES_CHAT_ICON_SIZE.height,
}: MessagesChatIconProps) {
  return (
    <View
      accessibilityLabel="Mensajes"
      style={{ width, height, alignItems: 'center', justifyContent: 'center' }}
    >
      <Image source={CHAT_ICON} style={{ width, height }} resizeMode="contain" />
    </View>
  );
}
