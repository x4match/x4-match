import { ReactNode, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ui } from '@/theme/tokens';
import { PrimaryButton } from './PrimaryButton';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export function Sheet({ visible, onClose, title, children, actionLabel, onAction }: SheetProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: ui.colors.overlay }} onPress={onClose}>
        <View style={{ flex: 1 }} />
      </Pressable>
      <BlurView intensity={40} tint="dark" style={{ borderTopLeftRadius: ui.radius.xl, borderTopRightRadius: ui.radius.xl, overflow: 'hidden' }}>
        <View
          style={{
            backgroundColor: ui.colors.glass,
            paddingTop: 12,
            paddingHorizontal: ui.spacing.lg,
            paddingBottom: insets.bottom + ui.spacing.lg,
            borderTopWidth: 1,
            borderColor: ui.colors.border,
          }}
        >
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: ui.colors.borderStrong, alignSelf: 'center', marginBottom: 16 }} />
          {title ? (
            <Text style={[ui.typography.h3, { color: ui.colors.textPrimary, marginBottom: 12 }]}>{title}</Text>
          ) : null}
          {children}
          {actionLabel && onAction ? (
            <PrimaryButton label={actionLabel} onPress={onAction} fullWidth style={{ marginTop: ui.spacing.lg }} />
          ) : null}
          <TouchableOpacity onPress={onClose} style={{ marginTop: ui.spacing.md, alignSelf: 'center' }}>
            <Text style={[ui.typography.bodySm, { color: ui.colors.textMuted }]}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    </Modal>
  );
}
