import { Linking, Modal, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppUpdate } from '@/lib/app-update';
import { ui } from '@/theme/tokens';

/**
 * Cartel de actualización de la app. Si la versión instalada es menor a la mínima configurada en el
 * backoffice, bloquea la app hasta actualizar; si solo hay una versión más nueva, la sugiere.
 */
export function AppUpdatePrompt() {
  const { state, dismiss } = useAppUpdate();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (state.kind === 'none') return null;

  const required = state.kind === 'required';
  const openStore = () => {
    void Linking.openURL(state.storeUrl);
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!required) dismiss(state.latestVersion);
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: required ? 'center' : 'flex-end',
          paddingHorizontal: ui.spacing.lg,
          paddingTop: insets.top + ui.spacing.lg,
          paddingBottom: insets.bottom + ui.spacing.lg,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.surface1,
            borderRadius: ui.radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: ui.spacing.xxl,
            gap: ui.spacing.md,
            ...ui.shadow.card,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: ui.radius.pill,
              backgroundColor: colors.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-up-circle" size={30} color={colors.accent} />
          </View>
          <Text style={[ui.typography.h2, { color: colors.textPrimary }]} accessibilityRole="header">
            {required ? 'Actualizá x4 match' : 'Hay una nueva versión'}
          </Text>
          <Text style={[ui.typography.body, { color: colors.textSecondary }]}>
            {required
              ? 'Esta versión ya no es compatible. Actualizá la app para seguir usándola.'
              : `La versión ${state.latestVersion} ya está disponible en la tienda.`}
          </Text>
          {state.message ? (
            <Text style={[ui.typography.bodySm, { color: colors.textMuted }]}>{state.message}</Text>
          ) : null}
          <View style={{ gap: ui.spacing.sm, marginTop: ui.spacing.sm }}>
            <PrimaryButton label="Actualizar" variant="accent" size="lg" fullWidth onPress={openStore} />
            {required ? null : (
              <PrimaryButton
                label="Más tarde"
                variant="ghost"
                fullWidth
                onPress={() => dismiss(state.latestVersion)}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
