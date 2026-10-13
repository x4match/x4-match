import { Pressable, Text, View } from 'react-native';
import { ui, fontFamily } from '@/theme/tokens';

type ChatBubbleProps = {
  content: string;
  timeLabel?: string;
  mine: boolean;
  /** Nombre del remitente, solo en burbujas ajenas (chats grupales). */
  senderName?: string;
  onLongPress?: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
};

export function ChatBubble({
  content,
  timeLabel,
  mine,
  senderName,
  onLongPress,
  disabled,
  accessibilityHint,
}: ChatBubbleProps) {
  return (
    <Pressable
      disabled={disabled || !onLongPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => ({
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          backgroundColor: mine ? ui.colors.primaryGlow : ui.colors.surface2,
          borderWidth: 1,
          borderColor: mine ? `${ui.colors.primary}40` : ui.colors.border,
          borderRadius: 18,
          borderBottomRightRadius: mine ? 6 : 18,
          borderBottomLeftRadius: mine ? 18 : 6,
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: 8,
        }}
      >
        {!mine && senderName ? (
          <Text
            style={{
              fontSize: 12,
              fontFamily: fontFamily.bold,
              color: ui.colors.primary,
              marginBottom: 2,
            }}
            numberOfLines={1}
          >
            {senderName}
          </Text>
        ) : null}
        <Text
          style={{
            color: ui.colors.textPrimary,
            fontSize: 15,
            lineHeight: 21,
            fontFamily: fontFamily.regular,
          }}
        >
          {content}
        </Text>
        {timeLabel ? (
          <Text
            style={{
              fontSize: 10,
              color: ui.colors.textMuted,
              marginTop: 4,
              textAlign: 'right',
            }}
          >
            {timeLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
