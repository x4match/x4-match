import { forwardRef, useRef, type ComponentProps } from 'react';
import { ScrollView } from 'react-native';
import { useScrollToTop } from 'expo-router';

type TabScrollViewProps = ComponentProps<typeof ScrollView>;

/**
 * ScrollView de tabs: al tocar de nuevo el tab activo en la bottom bar, sube al tope.
 */
export const TabScrollView = forwardRef<ScrollView, TabScrollViewProps>(function TabScrollView(
  props,
  forwardedRef,
) {
  const localRef = useRef<ScrollView>(null);

  useScrollToTop(localRef);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...props}
      ref={(node) => {
        localRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      }}
    />
  );
});
