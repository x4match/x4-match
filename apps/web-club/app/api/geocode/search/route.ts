import { NextResponse } from 'next/server';
import type { NominatimResult } from '@/lib/geocode';
import { mapNominatimResult } from '@/lib/geocode';

const NOMINATIM_UA = 'X4Match-ClubPanel/1.0 (https://club.x4match.com; contacto@x4match.com)';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';

  if (q.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '6');
  url.searchParams.set('accept-language', 'es');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': NOMINATIM_UA,
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { message: 'No se pudo buscar la ubicación' },
        { status: 502 },
      );
    }

    const data = (await res.json()) as NominatimResult[];
    const results = (Array.isArray(data) ? data : []).map(mapNominatimResult);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { message: 'Error al consultar el servicio de mapas' },
      { status: 502 },
    );
  }
}
