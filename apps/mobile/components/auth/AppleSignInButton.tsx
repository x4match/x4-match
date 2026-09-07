import { ActivityIndicator, Platform, StyleProp, View, ViewStyle } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { ui } from '@/theme/tokens';

type AppleSignInButtonProps = {
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  variant?: 'sign-in' | 'sign-up';
  style?: StyleProp<ViewStyle>;
};

export function AppleSignInButton({
  loading,
  disabled,
  onPress,
  variant = 'sign-in',
  style,
}: AppleSignInButtonProps) {
  if (Platform.OS !== 'ios') return null;

  if (loading) {
    return (
      <View
        style={[
          {
            height: 52,
            borderRadius: ui.radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: ui.colors.surface0,
          },
          style,
        ]}
      >
        <ActivityIndicator color={ui.colors.textPrimary} />
      </View>
    );
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={
        variant === 'sign-up'
          ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
          : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
      }
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={ui.radius.lg}
      style={[{ width: '100%', height: 52 }, style]}
      onPress={() => {
        if (disabled || loading) return;
        onPress();
      }}
    />
  );
}
