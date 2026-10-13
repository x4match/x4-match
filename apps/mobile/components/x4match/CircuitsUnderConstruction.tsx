import type { ComponentType } from 'react';
import { ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState, Screen, StackHeader } from '@/components/ui';
import { useFeatureFlags } from '@/lib/features';
import { ui } from '@/theme/tokens';

export function CircuitsUnderConstruction() {
  return (
    <EmptyState
      icon={<Ionicons name="construct-outline" size={32} color={ui.colors.primary} />}
      title="Circuitos en construcción"
      description="Estamos terminando el módulo de circuitos. Muy pronto vas a poder crear y jugar circuitos con fechas, sedes y ranking."
    />
  );
}

export function CircuitsUnderConstructionScreen() {
  return (
    <Screen>
      <StackHeader title="Circuitos" />
      <CircuitsUnderConstruction />
    </Screen>
  );
}

/** Pantalla de circuito que muestra "en construcción" mientras el módulo esté pausado. */
export function withCircuitsEnabled<P extends object>(ScreenComponent: ComponentType<P>) {
  return function CircuitGatedScreen(props: P) {
    const { flags, loading } = useFeatureFlags();
    if (loading) {
      return (
        <Screen>
          <StackHeader title="Circuitos" />
          <ActivityIndicator color={ui.colors.primary} style={{ marginTop: 48 }} />
        </Screen>
      );
    }
    return flags.circuits ? <ScreenComponent {...props} /> : <CircuitsUnderConstructionScreen />;
  };
}
