import type { Metadata } from 'next';
import { ShareLanding } from '@/components/ShareLanding';
import { fetchSharePreview, shareMetadata } from '@/lib/share';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return shareMetadata(await fetchSharePreview('match', id), `/partido/${id}`, 'Te invitaron a un partido');
}

export default async function PartidoPage({ params }: Props) {
  const { id } = await params;
  const preview = await fetchSharePreview('match', id);
  return (
    <ShareLanding
      preview={preview}
      appPath={`match/${id}`}
      eyebrow="Te invitaron a un partido"
      fallbackTitle="Partido en x4 match"
    />
  );
}
