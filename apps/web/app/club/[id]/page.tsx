import type { Metadata } from 'next';
import { ShareLanding } from '@/components/ShareLanding';
import { fetchSharePreview, shareMetadata } from '@/lib/share';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return shareMetadata(await fetchSharePreview('club', id), `/club/${id}`, 'Club en x4 match');
}

export default async function ClubPage({ params }: Props) {
  const { id } = await params;
  const preview = await fetchSharePreview('club', id);
  return (
    <ShareLanding preview={preview} appPath={`club/${id}`} eyebrow="Club" fallbackTitle="Club en x4 match" />
  );
}
