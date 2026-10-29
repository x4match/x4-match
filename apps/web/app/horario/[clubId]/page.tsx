import type { Metadata } from 'next';
import { ShareLanding } from '@/components/ShareLanding';
import { fetchSharePreview, firstParam, isUuid, shareMetadata } from '@/lib/share';

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ clubId: string }>; searchParams: Promise<SearchParams> };

function readSlot(search: SearchParams) {
  return {
    slot: firstParam(search.turno),
    date: firstParam(search.fecha),
    from: firstParam(search.desde),
    to: firstParam(search.hasta),
  };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { clubId } = await params;
  const { slot } = readSlot(await searchParams);
  const preview = isUuid(slot) ? await fetchSharePreview('slot', clubId, { slot }) : null;
  return shareMetadata(preview, `/horario/${clubId}`, 'Te pasaron un horario para jugar');
}

export default async function HorarioPage({ params, searchParams }: Props) {
  const { clubId } = await params;
  const { slot, date, from, to } = readSlot(await searchParams);
  const preview = isUuid(slot) ? await fetchSharePreview('slot', clubId, { slot }) : null;
  const query = new URLSearchParams(
    Object.entries({ clubId, slotId: slot, date, startHour: from, endHour: to }).filter(
      (entry): entry is [string, string] => !!entry[1],
    ),
  );
  return (
    <ShareLanding
      preview={preview}
      appPath={`create-open-match?${query}`}
      eyebrow="Horario para jugar"
      fallbackTitle="Te pasaron un horario para jugar"
    />
  );
}
