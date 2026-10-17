import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

/**
 * Espacio inferior cubierto por el teclado.
 *
 * En Android (Expo SDK 57+ / edge-to-edge) `adjustResize` ya no achica la ventana,
 * así que KeyboardAvoidingView con `behavior={undefined}` deja el input tapado.
 * Calculamos el solapamiento real: si el resize sí funciona, queda ~0.
 *
 * En iOS devolvemos la altura del teclado (útil para sheets / tab bar).
 */
export function useKeyboardBottomInset(): number {
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (event: KeyboardEvent) => {
      if (Platform.OS === 'ios') {
        setBottom(Math.ceil(event.endCoordinates.height));
        return;
      }

      const windowHeight = Dimensions.get('window').height;
      const keyboardTop = event.endCoordinates.screenY;
      const overlap = Math.max(0, Math.ceil(windowHeight - keyboardTop));
      setBottom(overlap);
    };

    const onHide = () => setBottom(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return bottom;
}
