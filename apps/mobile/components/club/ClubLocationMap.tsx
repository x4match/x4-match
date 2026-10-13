import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '@/theme/tokens';
import { AppCard, SectionHeader } from '@/components/x4match';

type ClubLocationMapProps = {
  name: string;
  address?: string | null;
  city?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

const TILE_SIZE = 256;
const MAP_ZOOM = 15;
/** 2x2 mosaic → 512px source; displayed at MAP_HEIGHT. */
const TILE_GRID = 2;
const MAP_HEIGHT = 160;

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

/** Slippy map tile indices for a lat/lng at zoom. */
function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y, n };
}

/** Fractional offset of lat/lng inside its tile (0–1). */
function latLngToTileOffset(lat: number, lng: number, zoom: number) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { fx: x - Math.floor(x), fy: y - Math.floor(y) };
}

function mapTileUrl(x: number, y: number, zoom: number) {
  const n = 2 ** zoom;
  const wrappedX = ((x % n) + n) % n;
  const clampedY = Math.min(Math.max(y, 0), n - 1);
  // ArcGIS: /tile/{z}/{y}/{x} — sin API key para uso razonable de preview.
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${clampedY}/${wrappedX}`;
}

function StaticTileMap({ lat, lng }: { lat: number; lng: number }) {
  const [width, setWidth] = useState(0);

  const { tiles, pinLeftPct, pinTopPct } = useMemo(() => {
    const { x: centerX, y: centerY } = latLngToTile(lat, lng, MAP_ZOOM);
    const { fx, fy } = latLngToTileOffset(lat, lng, MAP_ZOOM);
    const startX = centerX - Math.floor((TILE_GRID - 1) / 2);
    const startY = centerY - Math.floor((TILE_GRID - 1) / 2);
    const list: { key: string; uri: string }[] = [];
    for (let row = 0; row < TILE_GRID; row += 1) {
      for (let col = 0; col < TILE_GRID; col += 1) {
        const tx = startX + col;
        const ty = startY + row;
        list.push({
          key: `${tx}-${ty}`,
          uri: mapTileUrl(tx, ty, MAP_ZOOM),
        });
      }
    }
    const pinCol = centerX - startX;
    const pinRow = centerY - startY;
    return {
      tiles: list,
      pinLeftPct: ((pinCol + fx) / TILE_GRID) * 100,
      pinTopPct: ((pinRow + fy) / TILE_GRID) * 100,
    };
  }, [lat, lng]);

  const mosaicSize = TILE_SIZE * TILE_GRID;
  const scale = width > 0 ? Math.max(width / mosaicSize, MAP_HEIGHT / mosaicSize) : 1;
  const scaledSize = mosaicSize * scale;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        width: '100%',
        height: MAP_HEIGHT,
        borderRadius: ui.radius.md,
        overflow: 'hidden',
        backgroundColor: ui.colors.surfaceAlt,
      }}
    >
      {width > 0 ? (
        <View
          style={{
            position: 'absolute',
            width: scaledSize,
            height: scaledSize,
            left: (width - scaledSize) / 2,
            top: (MAP_HEIGHT - scaledSize) / 2,
          }}
        >
          <View
            style={{
              width: scaledSize,
              height: scaledSize,
              flexDirection: 'row',
              flexWrap: 'wrap',
            }}
          >
            {tiles.map((tile) => (
              <Image
                key={tile.key}
                source={{ uri: tile.uri }}
                style={{ width: scaledSize / TILE_GRID, height: scaledSize / TILE_GRID }}
                resizeMode="cover"
              />
            ))}
          </View>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: `${pinLeftPct}%`,
              top: `${pinTopPct}%`,
              marginLeft: -14,
              marginTop: -28,
            }}
          >
            <Ionicons name="location" size={28} color="#E11D48" />
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function ClubLocationMap({
  name,
  address,
  city,
  latitude,
  longitude,
}: ClubLocationMapProps) {
  const initialLat = parseCoord(latitude);
  const initialLng = parseCoord(longitude);
  const locationLine = [address, city].filter(Boolean).join(' · ');

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
            <StaticTileMap lat={lat} lng={lng} />
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
