'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageShell } from '@/components/layout/PageShell';
import { FormSection } from '@/components/layout/FormSection';

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
    onError: () => toast.error('No se pudo guardar'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <PageShell
      kicker="Cuenta"
      title="Contacto"
      description="Datos visibles en la tienda pública."
      variant="form"
    >
      <form onSubmit={onSubmit}>
        <FormSection>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email</Label>
              <Input
                id="contactEmail"
                className="min-h-11"
                type="email"
                placeholder="hola@tienda.com"
                value={form.contactEmail}
                onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactWhatsapp">WhatsApp</Label>
              <Input
                id="contactWhatsapp"
                className="min-h-11"
                placeholder="54911..."
                value={form.contactWhatsapp}
                onChange={(e) => setForm((f) => ({ ...f, contactWhatsapp: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactAddress">Dirección</Label>
              <Input
                id="contactAddress"
                className="min-h-11"
                placeholder="Calle, ciudad"
                value={form.contactAddress}
                onChange={(e) => setForm((f) => ({ ...f, contactAddress: e.target.value }))}
              />
            </div>
            <Button type="submit" className="min-h-11 font-bold" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </FormSection>
      </form>
    </PageShell>
  );
}
