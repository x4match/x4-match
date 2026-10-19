import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { fontFamily } from '@/theme/tokens';
import type { ShopPartner } from '@/lib/shop/marketplace';
import { partnerAccent, withAlpha } from './theme';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
}

export function PartnerLogo({ partner, size = 36 }: { partner: ShopPartner; size?: number }) {
  const [failed, setFailed] = useState(false);
  const accent = partnerAccent(partner.color);
  const radius = Math.round(size * 0.32);

  if (partner.logoUrl && !failed) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: '#FFFFFF',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={{ uri: partner.logoUrl }}
          style={{ width: size, height: size }}
          resizeMode="contain"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: withAlpha(accent, 0.16),
        borderWidth: 1,
        borderColor: withAlpha(accent, 0.4),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: accent,
          fontFamily: fontFamily.bold,
          fontWeight: '800',
          fontSize: Math.round(size * 0.38),
          textTransform: 'uppercase',
        }}
      >
        {initials(partner.name)}
      </Text>
    </View>
  );
}
