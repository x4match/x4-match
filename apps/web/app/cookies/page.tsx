import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { cookiesPolicy } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Política de Cookies',
};

export default function CookiesPage() {
  return <LegalPage doc={cookiesPolicy} />;
}
