import type { Metadata } from 'next';
import { ShareLanding } from '@/components/ShareLanding';
import { fetchSharePreview, shareMetadata } from '@/lib/share';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return shareMetadata(await fetchSharePreview('player', id), `/jugador/${id}`, 'Jugador en x4 match');
}

export default async function JugadorPage({ params }: Props) {
  const { id } = await params;
  const preview = await fetchSharePreview('player', id);
  return (
    <ShareLanding
      preview={preview}
      appPath={`player/${id}`}
      eyebrow="Jugador"
      fallbackTitle="Jugador en x4 match"
    />
  );
}
