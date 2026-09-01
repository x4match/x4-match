import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { accountDeletion } from '@/content/legal';

export const metadata: Metadata = {
  title: 'Eliminar cuenta',
  description:
    'Solicitá la eliminación de tu cuenta de x4 match. Información sobre qué datos se borran y cómo ejercer tu derecho.',
};

export default function EliminarCuentaPage() {
  return <LegalPage doc={accountDeletion} />;
}
