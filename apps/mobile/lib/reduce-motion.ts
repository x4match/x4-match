import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Prefer reduced motion (iOS Reduce Motion / Android equivalent). */
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      setReduceMotion(Boolean(enabled));
    });

    return () => {
      mounted = false;
      // RN types: subscription may be EventSubscription
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (subscription as any)?.remove?.();
    };
  }, []);

  return reduceMotion;
}
