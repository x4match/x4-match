'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageShell, PanelCard } from '@/components/layout/PageShell';

export default function AparienciaPage() {
  const { activeSponsorId, refetchSponsors } = useSponsor();
  const qc = useQueryClient();
  const sponsorQ = useQuery({
    queryKey: ['partner-sponsor', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}`)).data,
    enabled: !!activeSponsorId,
  });
  const [form, setForm] = useState({
    name: '',
    tagline: '',
    primaryColor: '#03AC0E',
    bannerUrl: '',
    logoUrl: '',
    homeIntro: '',
  });

  useEffect(() => {
    const s = sponsorQ.data;
    if (!s) return;
    setForm({
      name: s.name || '',
      tagline: s.tagline || '',
      primaryColor: s.primary_color || '#03AC0E',
      bannerUrl: s.banner_url || '',
      logoUrl: s.logo_url || '',
      homeIntro: s.home_intro || '',
    });
  }, [sponsorQ.data]);

  const save = useMutation({
    mutationFn: async () =>
      api.patch(`/sponsors/me/${activeSponsorId}`, {
        name: form.name,
        tagline: form.tagline,
        primaryColor: form.primaryColor,
        bannerUrl: form.bannerUrl || undefined,
        logoUrl: form.logoUrl || undefined,
        homeIntro: form.homeIntro,
      }),
    onSuccess: () => {
      toast.success('Apariencia guardada');
      qc.invalidateQueries({ queryKey: ['partner-sponsor', activeSponsorId] });
      refetchSponsors();
    },
    onError: () => toast.error('No se pudo guardar'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  const fields: Array<{ key: keyof typeof form; label: string }> = [
    { key: 'name', label: 'Nombre' },
    { key: 'tagline', label: 'Tagline' },
    { key: 'logoUrl', label: 'URL del logo' },
    { key: 'bannerUrl', label: 'URL del banner' },
    { key: 'primaryColor', label: 'Color primario' },
  ];

  return (
    <PageShell
      kicker="Tienda"
      title="Apariencia"
      description="Identidad visual de tu storefront."
      narrow
    >
      <form onSubmit={onSubmit}>
        <PanelCard>
          <div className="space-y-4">
            {fields.map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{label}</Label>
                <div className="flex gap-2">
                  <Input
                    id={key}
                    className="min-h-11"
                    type={key === 'primaryColor' ? 'text' : 'text'}
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                  {key === 'primaryColor' ? (
                    <input
                      type="color"
                      aria-label="Elegir color"
                      className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                      value={form.primaryColor}
                      onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                    />
                  ) : null}
                </div>
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="homeIntro">Intro home</Label>
              <textarea
                id="homeIntro"
                className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                rows={3}
                value={form.homeIntro}
                onChange={(e) => setForm((f) => ({ ...f, homeIntro: e.target.value }))}
              />
            </div>
            <div
              className="overflow-hidden rounded-xl border border-border p-4 text-white"
              style={{ background: `linear-gradient(135deg, ${form.primaryColor}, #0b1220)` }}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-white/70">Preview</p>
              <p className="mt-1 text-xl font-extrabold">{form.name || 'Tu tienda'}</p>
              <p className="mt-1 text-sm text-white/85">{form.tagline || 'Tagline'}</p>
            </div>
            <Button type="submit" className="min-h-11 font-bold" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </PanelCard>
      </form>
    </PageShell>
  );
}
