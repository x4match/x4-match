import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useKeyboardBottomInset } from '@/lib/use-keyboard-bottom-inset';

type KeyboardAvoidProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Solo iOS; en Android el inset se calcula con el solapamiento real del teclado. */
  keyboardVerticalOffset?: number;
};

/**
 * Evita que el teclado tape los inputs.
 * iOS: KeyboardAvoidingView con padding.
 * Android: padding inferior según solapamiento real (compatible con edge-to-edge).
 */
export function KeyboardAvoid({
  children,
  style,
  keyboardVerticalOffset = 0,
}: KeyboardAvoidProps) {
  const androidInset = useKeyboardBottomInset();

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={style}
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[style, androidInset > 0 ? { paddingBottom: androidInset } : null]}>{children}</View>
  );
}
