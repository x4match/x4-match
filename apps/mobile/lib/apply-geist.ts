import { Text, TextInput } from 'react-native';
import { fontFamily } from '@/theme/tokens';

type StyleDefaults = {
  style?: unknown;
};

/**
 * Apply Geist as the default Text/textInput family once fonts are loaded.
 * Screens that set fontFamily via ui.typography.* still win.
 */
export function applyGeistTextDefaults() {
  const existingText = (Text as unknown as { defaultProps?: StyleDefaults }).defaultProps ?? {};
  (Text as unknown as { defaultProps: StyleDefaults }).defaultProps = {
    ...existingText,
    style: [{ fontFamily: fontFamily.regular }, existingText.style],
  };

  const existingInput = (TextInput as unknown as { defaultProps?: StyleDefaults }).defaultProps ?? {};
  (TextInput as unknown as { defaultProps: StyleDefaults }).defaultProps = {
    ...existingInput,
    style: [{ fontFamily: fontFamily.regular }, existingInput.style],
  };
}
