'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchSponsorBySlug } from '@/lib/storefront-api';

export default function ContactPage() {
  const { slug } = useParams<{ slug: string }>();
  const storeQ = useQuery({ queryKey: ['store', slug], queryFn: () => fetchSponsorBySlug(slug) });
  const s: any = storeQ.data;
  const wa = s?.contact_whatsapp?.replace(/\D/g, '');

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold">Contacto</h1>
      <p className="mt-2 text-slate-600">{s?.name}</p>
      {s?.contact_email ? <p className="mt-4">Email: {s.contact_email}</p> : null}
      {s?.contact_address ? <p className="mt-2">Dirección: {s.contact_address}</p> : null}
      {wa ? (
        <a
          className="mt-6 inline-block rounded-full bg-green-600 px-5 py-2.5 font-semibold text-white"
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
        </a>
      ) : null}
    </div>
  );
}
