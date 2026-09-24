'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';

export default function ContactoDashPage() {
  const { activeSponsorId } = useSponsor();
  const qc = useQueryClient();
  const sponsorQ = useQuery({
    queryKey: ['partner-sponsor', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}`)).data,
    enabled: !!activeSponsorId,
  });
  const [form, setForm] = useState({
    contactEmail: '',
    contactWhatsapp: '',
    contactAddress: '',
  });

  useEffect(() => {
    const s = sponsorQ.data;
    if (!s) return;
    setForm({
      contactEmail: s.contact_email || '',
      contactWhatsapp: s.contact_whatsapp || '',
      contactAddress: s.contact_address || '',
    });
  }, [sponsorQ.data]);

  const save = useMutation({
    mutationFn: async () => api.patch(`/sponsors/me/${activeSponsorId}`, form),
    onSuccess: () => {
      toast.success('Contacto guardado');
      qc.invalidateQueries({ queryKey: ['partner-sponsor', activeSponsorId] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">Contacto</h1>
      <input className="w-full rounded border px-3 py-2" placeholder="Email" value={form.contactEmail} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} />
      <input className="w-full rounded border px-3 py-2" placeholder="WhatsApp" value={form.contactWhatsapp} onChange={(e) => setForm((f) => ({ ...f, contactWhatsapp: e.target.value }))} />
      <input className="w-full rounded border px-3 py-2" placeholder="Dirección" value={form.contactAddress} onChange={(e) => setForm((f) => ({ ...f, contactAddress: e.target.value }))} />
      <button type="submit" className="rounded bg-teal-700 px-4 py-2 text-white">
        Guardar
      </button>
    </form>
  );
}
