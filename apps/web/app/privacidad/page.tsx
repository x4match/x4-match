import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { privacyPolicy } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
};

export default function PrivacidadPage() {
  return <LegalPage doc={privacyPolicy} />;
}
