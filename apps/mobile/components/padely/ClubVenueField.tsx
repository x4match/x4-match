import { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ui } from '@/theme/tokens';
import { InputField } from './InputField';

type ClubHit = {
  id: string;
  name: string;
  city?: string;
  zone?: string;
  address?: string;
};

function normalizeSearch(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

type ClubVenueFieldProps = {
  venue: string;
  onVenueChange: (value: string) => void;
  zone: string;
  onZoneChange: (value: string) => void;
  enabled?: boolean;
};

export function ClubVenueField({
  venue,
  onVenueChange,
  zone,
  onZoneChange,
  enabled = true,
}: ClubVenueFieldProps) {
  const { data: clubs = [] } = useQuery({
    queryKey: ['clubs-venue-autocomplete'],
    queryFn: async () => {
      const res = await api.get('/clubs');
      return (Array.isArray(res.data) ? res.data : []) as ClubHit[];
    },
    enabled,
  });

  const suggestions = useMemo(() => {
    const q = normalizeSearch(venue.trim());
    if (q.length < 2) return [];
    return clubs
      .filter((club) => {
        const haystack = normalizeSearch(
          [club.name, club.zone, club.city, club.address].filter(Boolean).join(' '),
        );
        return haystack.includes(q);
      })
      .slice(0, 6);
  }, [clubs, venue]);

  const selectClub = (club: ClubHit) => {
    onVenueChange(club.name);
    const nextZone = [club.zone, club.city].filter(Boolean).join(', ');
    if (nextZone) onZoneChange(nextZone);
  };

  return (
    <View>
      <InputField
        label="Dónde reservaste"
        placeholder="Club, cancha o dirección"
        value={venue}
        onChangeText={onVenueChange}
        autoCorrect={false}
      />
      {suggestions.length > 0 ? (
        <View
          style={{
            marginTop: -6,
            marginBottom: 12,
            borderRadius: ui.radius.md,
            borderWidth: 1,
            borderColor: ui.colors.border,
            backgroundColor: ui.colors.surface1,
            overflow: 'hidden',
          }}
        >
          {suggestions.map((club, index) => (
            <TouchableOpacity
              key={club.id}
              onPress={() => selectClub(club)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderBottomWidth: index < suggestions.length - 1 ? 1 : 0,
                borderBottomColor: ui.colors.border,
              }}
            >
              <Text style={{ fontWeight: '600', color: ui.colors.textPrimary }}>{club.name}</Text>
              {club.zone || club.city || club.address ? (
                <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
                  {[club.zone, club.city, club.address].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : venue.trim().length >= 2 ? (
        <Text style={{ fontSize: 12, color: ui.colors.textMuted, marginTop: -6, marginBottom: 12 }}>
          No hay clubs registrados con ese nombre. Podés escribir la dirección a mano.
        </Text>
      ) : null}
      <InputField
        label="Zona"
        placeholder="Palermo, Zona Norte…"
        value={zone}
        onChangeText={onZoneChange}
      />
    </View>
  );
}
