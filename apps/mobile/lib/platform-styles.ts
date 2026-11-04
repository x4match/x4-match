import { Platform, type ViewStyle } from 'react-native';

/**
 * En Android, `borderStyle: 'dashed' | 'dotted'` combinado con `borderRadius`
 * puede matar el proceso nativo (crash silencioso al renderizar).
 * En iOS se mantiene el punteado; en Android se usa sólido.
 */
export function dashedBorderStyle(extras: ViewStyle = {}): ViewStyle {
  return {
    ...extras,
    borderStyle: Platform.OS === 'android' ? 'solid' : 'dashed',
  };
}
