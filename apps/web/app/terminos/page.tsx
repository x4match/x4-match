import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { termsPlayers } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Términos y Condiciones — Jugadores',
};

export default function TerminosPage() {
  return <LegalPage doc={termsPlayers} />;
}
