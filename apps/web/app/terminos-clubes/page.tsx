import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { termsClubs } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Términos y Condiciones — Clubes',
};

export default function TerminosClubesPage() {
  return <LegalPage doc={termsClubs} />;
}
