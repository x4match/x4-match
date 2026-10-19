import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticSelection } from '@/lib/haptics';
import { fontFamily } from '@/theme/tokens';
import { SHOP_GLASS, SHOP_LIME, SHOP_MUTED } from './theme';

export function MarketplaceEntryCard({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir marketplace de jugadores"
      onPress={() => {
        void hapticSelection();
        onPress();
      }}
      style={({ pressed }) => [
        SHOP_GLASS,
        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: 'rgba(215,255,0,0.12)',
          borderWidth: 1,
          borderColor: 'rgba(215,255,0,0.4)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="people" size={20} color={SHOP_LIME} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800', fontFamily: fontFamily.bold }}>
          Marketplace de jugadores
        </Text>
        <Text style={{ color: SHOP_MUTED, fontSize: 12, marginTop: 2, fontFamily: fontFamily.regular }}>
          Comprá y vendé paletas, zapatillas y más entre jugadores.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={SHOP_LIME} />
    </Pressable>
  );
}
