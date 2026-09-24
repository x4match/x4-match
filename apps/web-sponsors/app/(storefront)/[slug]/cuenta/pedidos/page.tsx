'use client';

import { useParams } from 'next/navigation';
import { getStorefrontCustomer } from '@/lib/storefront-api';

export default function CustomerOrdersPage() {
  const { slug } = useParams<{ slug: string }>();
  const customer = typeof window !== 'undefined' ? getStorefrontCustomer(slug) : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold">Mis pedidos</h1>
      {customer ? (
        <p className="mt-2 text-slate-600">Hola {customer.name}. Tus pedidos aparecen en el email de confirmación y acá cuando el partner los procese.</p>
      ) : (
        <p className="mt-2 text-slate-600">Iniciá sesión para ver tu historial.</p>
      )}
    </div>
  );
}
