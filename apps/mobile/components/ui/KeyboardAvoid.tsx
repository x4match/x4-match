import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardBottomInset } from '@/lib/use-keyboard-bottom-inset';

type KeyboardAvoidProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Solo iOS; en Android el inset se calcula con el solapamiento real del teclado. */
  keyboardVerticalOffset?: number;
  /**
   * Reserva el inset inferior (barra de navegación de Android / home indicator de iOS)
   * cuando el teclado está cerrado. Usar en pantallas con un input fijo abajo.
   */
  safeAreaBottom?: boolean;
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
  safeAreaBottom = false,
}: KeyboardAvoidProps) {
  const keyboardInset = useKeyboardBottomInset();
  const insets = useSafeAreaInsets();
  const restingBottom = safeAreaBottom && keyboardInset === 0 ? insets.bottom : 0;

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView
        style={[style, restingBottom > 0 ? { paddingBottom: restingBottom } : null]}
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {children}
      </KeyboardAvoidingView>
    );
  }

  const bottom = keyboardInset > 0 ? keyboardInset : restingBottom;
  return (
    <View style={[style, bottom > 0 ? { paddingBottom: bottom } : null]}>{children}</View>
  );
}
