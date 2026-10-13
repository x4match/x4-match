/** Geocoding helpers for club location (Nominatim), shared with web-club semantics. */

export type ClubLocationValue = {
  city: string;
  address: string;
  label: string;
  latitude: number | null;
  longitude: number | null;
};

export type GeocodeHit = ClubLocationValue & {
  id: string;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  quarter?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  state_district?: string;
  country?: string;
};

type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
  error?: string;
};

const NOMINATIM_UA = 'X4Match-Mobile/1.0 (https://x4match.com; contacto@x4match.com)';

function uniqueJoin(parts: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.join(', ');
}

export function emptyClubLocation(): ClubLocationValue {
  return {
    city: '',
    address: '',
    label: '',
    latitude: null,
    longitude: null,
  };
}

export function parseCoord(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function clubLocationFromParts(input: {
  city?: string | null;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}): ClubLocationValue {
  const city = input.city?.trim() || '';
  const address = input.address?.trim() || '';
  const latitude = parseCoord(input.latitude);
  const longitude = parseCoord(input.longitude);
  const label = uniqueJoin([address, city]);
  return { city, address, label, latitude, longitude };
}

export function enrichClubLocation(loc: ClubLocationValue): ClubLocationValue {
  const label = loc.label?.trim() || '';
  let address = loc.address?.trim() || '';
  let city = loc.city?.trim() || '';

  if ((!address || !city) && label) {
    const parts = label
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => !/^argentina$/i.test(p) && !/^\d{4,}[a-z]*$/i.test(p));

    if (!city && parts.length >= 2) {
      const province = parts[parts.length - 1] || '';
      const locality = parts.length >= 2 ? parts[parts.length - 2] : '';
      city = uniqueJoin([locality, province]);
    }

    if (!address && parts.length > 0) {
      const streetParts = parts.length >= 2 ? parts.slice(0, -2) : parts;
      address = streetParts.join(', ') || parts[0] || '';
    }
  }

  return {
    ...loc,
    address,
    city,
    label: label || uniqueJoin([address, city]),
  };
}

export function mapNominatimResult(result: NominatimResult): GeocodeHit {
  const a = result.address || {};
  const street = [a.house_number, a.road || a.pedestrian].filter(Boolean).join(' ').trim();
  const neighbourhood =
    a.neighbourhood || a.suburb || a.city_district || a.quarter || '';
  const locality = a.city || a.town || a.village || a.municipality || a.county || '';
  const province = a.state || '';

  const address = uniqueJoin([
    street || result.display_name.split(',')[0]?.trim(),
    neighbourhood &&
    neighbourhood.toLowerCase() !== locality.toLowerCase() &&
    neighbourhood.toLowerCase() !== province.toLowerCase()
      ? neighbourhood
      : null,
  ]);

  const city = uniqueJoin([locality, province]);
  const latitude = parseCoord(result.lat);
  const longitude = parseCoord(result.lon);

  return {
    id: String(result.place_id),
    city,
    address,
    label: result.display_name,
    latitude,
    longitude,
  };
}

async function nominatimFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': NOMINATIM_UA,
    },
  });
}

export async function searchClubLocations(query: string): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '6');
  url.searchParams.set('accept-language', 'es');

  const res = await nominatimFetch(url.toString());
  if (!res.ok) throw new Error('No se pudo buscar la ubicación');
  const data = (await res.json()) as NominatimResult[];
  return (Array.isArray(data) ? data : []).map(mapNominatimResult);
}

export async function reverseClubLocation(lat: number, lon: number): Promise<GeocodeHit | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'es');
  url.searchParams.set('zoom', '18');

  const res = await nominatimFetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimResult;
  if (data.error) return null;
  return mapNominatimResult(data);
}

export function clubLocationPayload(loc: ClubLocationValue) {
  const enriched = enrichClubLocation(loc);
  return {
    city: enriched.city.trim() || undefined,
    address: enriched.address.trim() || undefined,
    latitude: enriched.latitude ?? undefined,
    longitude: enriched.longitude ?? undefined,
  };
}

export function hasClubLocation(loc: ClubLocationValue): boolean {
  return Boolean(loc.city.trim() || loc.address.trim() || (loc.latitude != null && loc.longitude != null));
}
