import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '@/theme/tokens';
import { requestPlayerCoordinates } from '@/lib/geolocation';
import {
  type ClubLocationValue,
  type GeocodeHit,
  emptyClubLocation,
  enrichClubLocation,
  reverseClubLocation,
  searchClubLocations,
} from '@/lib/club/club-geocode';
import { InputField } from '@/components/x4match';

type ClubLocationPickerProps = {
  value: ClubLocationValue;
  onChange: (value: ClubLocationValue) => void;
  requiredHint?: boolean;
};

export function ClubLocationPicker({
  value,
  onChange,
  requiredHint = false,
}: ClubLocationPickerProps) {
  const [query, setQuery] = useState(value.label || value.address || '');
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSearchRef = useRef(false);

  useEffect(() => {
    const next = value.label || [value.address, value.city].filter(Boolean).join(', ');
    setQuery((prev) => (prev === next ? prev : next));
  }, [value.label, value.address, value.city]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    if (q.length < 3) {
      setHits([]);
      setSearching(false);
      return;
    }
    if (value.label && q === value.label.trim() && value.latitude != null) {
      setHits([]);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const results = await searchClubLocations(q);
          setHits(results);
          setError(null);
        } catch {
          setHits([]);
          setError('No se pudo buscar la ubicación');
        } finally {
          setSearching(false);
        }
      })();
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, value.label, value.latitude]);

  const applyHit = (hit: GeocodeHit) => {
    const next = enrichClubLocation({
      city: hit.city,
      address: hit.address,
      label: hit.label,
      latitude: hit.latitude,
      longitude: hit.longitude,
    });
    skipSearchRef.current = true;
    onChange(next);
    setQuery(next.label || [next.address, next.city].filter(Boolean).join(', '));
    setHits([]);
    setError(null);
  };

  const useMyLocation = async () => {
    setLocating(true);
    setError(null);
    try {
      const coords = await requestPlayerCoordinates({ showAlerts: true });
      if (!coords) return;

      const hit = await reverseClubLocation(coords.latitude, coords.longitude);
      if (hit) {
        applyHit({
          ...hit,
          latitude: hit.latitude ?? coords.latitude,
          longitude: hit.longitude ?? coords.longitude,
        });
        return;
      }

      const fallback = enrichClubLocation({
        ...emptyClubLocation(),
        label: coords.label || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      skipSearchRef.current = true;
      onChange(fallback);
      setQuery(fallback.label);
      setHits([]);
      setError('Ubicación capturada; completá ciudad y dirección si hace falta.');
    } finally {
      setLocating(false);
    }
  };

  const hasCoords = value.latitude != null && value.longitude != null;
  const summary = [value.address, value.city].filter(Boolean).join(' · ');

  return (
    <View style={{ gap: 10, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textSecondary }}>
          Ubicación del club
        </Text>
        <Pressable onPress={() => void useMyLocation()} disabled={locating} hitSlop={8}>
          {locating ? (
            <ActivityIndicator size="small" color={ui.colors.primary} />
          ) : (
            <Text style={{ fontSize: 13, fontWeight: '700', color: ui.colors.primary }}>
              Vincular al GPS
            </Text>
          )}
        </Pressable>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: ui.colors.border,
          borderRadius: ui.radius.md,
          backgroundColor: ui.colors.surface1,
          paddingHorizontal: 12,
          minHeight: 48,
        }}
      >
        <Ionicons name="location-sharp" size={18} color={ui.colors.primary} />
        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (value.latitude != null || value.city || value.address) {
              onChange({
                ...value,
                label: text,
                latitude: null,
                longitude: null,
              });
            }
          }}
          placeholder="Buscar dirección, barrio o ciudad…"
          placeholderTextColor={ui.colors.textMuted}
          style={{
            flex: 1,
            color: ui.colors.textPrimary,
            fontSize: 15,
            paddingVertical: 10,
          }}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {searching ? <ActivityIndicator size="small" color={ui.colors.primary} /> : null}
      </View>

      {hits.length > 0 ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: ui.colors.border,
            borderRadius: ui.radius.md,
            backgroundColor: ui.colors.surface1,
            maxHeight: 220,
            overflow: 'hidden',
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {hits.map((hit) => (
              <Pressable
                key={hit.id}
                onPress={() => applyHit(hit)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: ui.colors.border,
                }}
              >
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={ui.colors.primary}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: ui.colors.textPrimary, fontSize: 13 }}>
                    {hit.address || hit.city || 'Ubicación'}
                  </Text>
                  <Text
                    style={{ fontSize: 11, color: ui.colors.textSecondary, marginTop: 2 }}
                    numberOfLines={2}
                  >
                    {hit.label}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {error ? (
        <Text style={{ fontSize: 12, color: ui.colors.accent, lineHeight: 16 }}>{error}</Text>
      ) : null}

      {hasCoords ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            backgroundColor: 'rgba(215,255,0,0.10)',
            borderRadius: ui.radius.md,
            padding: 12,
            borderWidth: 1,
            borderColor: 'rgba(215,255,0,0.22)',
          }}
        >
          <Ionicons
            name="checkmark-circle"
            size={18}
            color={ui.colors.primary}
            style={{ marginTop: 1 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: ui.colors.primary }}>
              Ubicación integrada: {summary || `${value.latitude!.toFixed(5)}, ${value.longitude!.toFixed(5)}`}
            </Text>
          </View>
        </View>
      ) : requiredHint ? (
        <Text style={{ fontSize: 11, color: ui.colors.textMuted }}>Buscá una dirección o vinculá el GPS</Text>
      ) : null}

      <InputField
        label="Ciudad"
        value={value.city}
        onChangeText={(city) => onChange({ ...value, city })}
        placeholder="Se completa al elegir ubicación"
      />
      <InputField
        label="Dirección"
        value={value.address}
        onChangeText={(address) => onChange({ ...value, address })}
        placeholder="Calle y número"
      />
    </View>
  );
}
