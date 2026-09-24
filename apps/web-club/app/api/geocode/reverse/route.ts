import { NextResponse } from 'next/server';
import type { NominatimResult } from '@/lib/geocode';
import { mapNominatimResult, parseCoord } from '@/lib/geocode';

const NOMINATIM_UA = 'X4Match-ClubPanel/1.0 (https://club.x4match.com; contacto@x4match.com)';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseCoord(searchParams.get('lat'));
  const lon = parseCoord(searchParams.get('lon'));

  if (lat == null || lon == null) {
    return NextResponse.json({ message: 'Coordenadas inválidas' }, { status: 400 });
  }

  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('accept-language', 'es');
  url.searchParams.set('zoom', '18');

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
        { message: 'No se pudo resolver la ubicación' },
        { status: 502 },
      );
    }

    const data = (await res.json()) as NominatimResult & { error?: string };
    if (data.error) {
      return NextResponse.json({ message: data.error }, { status: 404 });
    }

    return NextResponse.json({ result: mapNominatimResult(data) });
  } catch {
    return NextResponse.json(
      { message: 'Error al consultar el servicio de mapas' },
      { status: 502 },
    );
  }
}
