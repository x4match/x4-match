import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ui } from '@/theme/tokens';

type ToastType = 'success' | 'error' | 'info';

type ToastState = {
  message: string;
  type: ToastType;
  visible: boolean;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', visible: false });
  const opacity = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 2600);
  }, []);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: toast.visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [opacity, toast.visible]);

  const bg =
    toast.type === 'success'
      ? ui.colors.successSoft
      : toast.type === 'error'
        ? ui.colors.dangerSoft
        : ui.colors.surface2;

  const color =
    toast.type === 'success'
      ? ui.colors.success
      : toast.type === 'error'
        ? ui.colors.danger
        : ui.colors.textPrimary;

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast.visible ? (
        <Animated.View
          style={{
            opacity,
            position: 'absolute',
            top: insets.top + 12,
            left: 16,
            right: 16,
            backgroundColor: bg,
            borderRadius: ui.radius.md,
            borderWidth: 1,
            borderColor: ui.colors.border,
            paddingHorizontal: 16,
            paddingVertical: 12,
            zIndex: 9999,
          }}
        >
          <Text style={[ui.typography.bodySm, { color, textAlign: 'center' }]}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
