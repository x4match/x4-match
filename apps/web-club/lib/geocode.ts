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

export type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
};

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

export function parseCoord(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

/**
 * Completa city/address si vienen vacíos, usando el label tipo Nominatim
 * ("Calle, Barrio, Ciudad, Provincia, País").
 */
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
      // Últimos segmentos útiles: ciudad + provincia
      const province = parts[parts.length - 1] || '';
      const locality = parts.length >= 2 ? parts[parts.length - 2] : '';
      city = uniqueJoin([locality, province]);
    }

    if (!address && parts.length > 0) {
      // Todo lo anterior a ciudad/provincia ≈ calle (+ barrio)
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
  const locality =
    a.city || a.town || a.village || a.municipality || a.county || '';
  // En AR, state_district suele ser "Comuna N" — preferimos state (provincia / CABA).
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
  const label = result.display_name;

  return {
    id: String(result.place_id),
    city,
    address,
    label,
    latitude,
    longitude,
  };
}

export function osmEmbedUrl(lat: number, lng: number, delta = 0.012) {
  const left = lng - delta;
  const right = lng + delta;
  const top = lat + delta;
  const bottom = lat - delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lng}`;
}
