import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '@/theme/tokens';
import { AppCard, SectionHeader } from '@/components/padely';

type ClubLocationMapProps = {
  name: string;
  address?: string | null;
  city?: string | null;
  zone?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

function parseCoord(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function buildMapsUrl(name: string, lat: number, lng: number, address?: string | null) {
  const label = encodeURIComponent(name);
  const query = address ? encodeURIComponent(address) : `${lat},${lng}`;
  if (Platform.OS === 'ios') {
    return `maps:0,0?q=${label}@${lat},${lng}`;
  }
  if (Platform.OS === 'android') {
    return `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function staticMapUrl(lat: number, lng: number) {
  // OSM static endpoint; fallback visual for preview.
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=640x280&markers=${lat},${lng},lightblue1`;
}

export function ClubLocationMap({
  name,
  address,
  city,
  zone,
  latitude,
  longitude,
}: ClubLocationMapProps) {
  const initialLat = parseCoord(latitude);
  const initialLng = parseCoord(longitude);
  const locationLine = [address, zone, city].filter(Boolean).join(' · ');

  const [lat, setLat] = useState<number | null>(initialLat);
  const [lng, setLng] = useState<number | null>(initialLng);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);

  useEffect(() => {
    setLat(initialLat);
    setLng(initialLng);
    setGeocodeFailed(false);
  }, [initialLat, initialLng]);

  useEffect(() => {
    if (initialLat != null && initialLng != null) return;
    if (!locationLine) return;

    let cancelled = false;
    setGeocoding(true);
    setGeocodeFailed(false);

    (async () => {
      try {
        const results = await Location.geocodeAsync(locationLine);
        if (cancelled) return;
        const first = results?.[0];
        if (first && Number.isFinite(first.latitude) && Number.isFinite(first.longitude)) {
          setLat(first.latitude);
          setLng(first.longitude);
        } else {
          setGeocodeFailed(true);
        }
      } catch {
        if (!cancelled) setGeocodeFailed(true);
      } finally {
        if (!cancelled) setGeocoding(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialLat, initialLng, locationLine]);

  const hasCoords = lat != null && lng != null;

  const openMaps = () => {
    if (hasCoords) {
      Linking.openURL(buildMapsUrl(name, lat, lng, address || locationLine));
      return;
    }
    if (locationLine) {
      Linking.openURL(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationLine)}`,
      );
    }
  };

  if (!hasCoords && !locationLine) {
    return null;
  }

  return (
    <View style={{ marginBottom: 16 }}>
      <SectionHeader title="Ubicación" subtitle="Cómo llegar al club" dark />
      <AppCard padding="sm">
        {hasCoords ? (
          <Pressable onPress={openMaps} style={{ marginBottom: 12 }}>
            <Image
              source={{ uri: staticMapUrl(lat, lng) }}
              style={{
                width: '100%',
                height: 160,
                borderRadius: ui.radius.md,
                backgroundColor: ui.colors.surfaceAlt,
              }}
              resizeMode="cover"
            />
            <View
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: 'rgba(0,0,0,0.65)',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: ui.radius.pill,
              }}
            >
              <Ionicons name="navigate" size={14} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Abrir en Maps</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            onPress={openMaps}
            style={{
              height: 120,
              borderRadius: ui.radius.md,
              backgroundColor: ui.colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
              paddingHorizontal: 16,
            }}
          >
            {geocoding ? (
              <>
                <ActivityIndicator color={ui.colors.primary} />
                <Text style={{ color: ui.colors.textMuted, fontSize: 12, marginTop: 8 }}>
                  Buscando ubicación…
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="map-outline" size={36} color={ui.colors.primary} />
                <Text style={{ color: ui.colors.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 8 }}>
                  Abrir en Maps
                </Text>
                <Text style={{ color: ui.colors.textMuted, fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                  {geocodeFailed
                    ? 'No pudimos cargar el mapa acá, pero podés abrir la dirección en Maps'
                    : 'Tocá para ver cómo llegar'}
                </Text>
              </>
            )}
          </Pressable>
        )}

        {locationLine ? (
          <Pressable onPress={openMaps} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Ionicons name="location" size={20} color={ui.colors.primary} />
            <Text style={{ flex: 1, color: ui.colors.textSecondary, fontSize: 14, lineHeight: 20 }}>
              {locationLine}
            </Text>
          </Pressable>
        ) : null}
      </AppCard>
    </View>
  );
}
