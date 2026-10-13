import { ReactNode, useMemo } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { fontFamily } from '@/theme/tokens';

type CircularProgressRingProps = {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  style?: ViewStyle;
  showValue?: boolean;
  children?: ReactNode;
};

/**
 * Gráfico de anillo (ring / donut) con react-native-gifted-charts.
 */
export function CircularProgressRing({
  value,
  maxValue = 100,
  size = 64,
  strokeWidth = 8,
  color = '#D7FF00',
  trackColor = 'rgba(255,255,255,0.12)',
  style,
  showValue = true,
  children,
}: CircularProgressRingProps) {
  const safeMax = Math.max(maxValue, 1);
  const safeValue = Math.max(0, Number(value) || 0);
  const filled = Math.min(safeValue, safeMax);
  const remaining = Math.max(safeMax - filled, 0.0001);

  const chartData = useMemo(() => {
    if (safeValue <= 0) {
      return [{ value: 1, color: trackColor }];
    }
    return [
      { value: filled, color },
      { value: remaining, color: trackColor },
    ];
  }, [color, filled, remaining, safeValue, trackColor]);

  const radius = size / 2;
  const innerRadius = Math.max(4, radius - strokeWidth);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <PieChart
        data={chartData}
        donut
        ring
        radius={radius}
        innerRadius={innerRadius}
        strokeWidth={0}
        innerCircleColor="#161616"
        backgroundColor="transparent"
        showText={false}
        isAnimated
        animationDuration={700}
        initialAngle={-Math.PI / 2}
        centerLabelComponent={() => (
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            {showValue ? (
              <Text
                style={{
                  fontSize: Math.round(size * 0.26),
                  fontWeight: '700',
                  fontFamily: fontFamily.regular,
                  color: '#FAFAFA',
                  textAlign: 'center',
                }}
              >
                {Math.round(safeValue)}
              </Text>
            ) : null}
            {children}
          </View>
        )}
      />
    </View>
  );
}
