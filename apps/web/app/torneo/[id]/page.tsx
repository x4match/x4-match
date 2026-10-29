import type { Metadata } from 'next';
import { ShareLanding } from '@/components/ShareLanding';
import { fetchSharePreview, firstParam, shareMetadata } from '@/lib/share';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return shareMetadata(await fetchSharePreview('tournament', id), `/torneo/${id}`, 'Torneo en x4 match');
}

export default async function TorneoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const invite = firstParam((await searchParams).invite);
  const preview = await fetchSharePreview('tournament', id);
  return (
    <ShareLanding
      preview={preview}
      appPath={
        invite
          ? `tournament/${id}?invite=${encodeURIComponent(invite)}`
          : `tournament/${id}`
      }
      eyebrow={invite ? 'Invitación a torneo' : 'Torneo'}
      fallbackTitle="Torneo en x4 match"
    />
  );
}
