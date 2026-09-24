'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';

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
    primaryColor: '#0F766E',
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
      primaryColor: s.primary_color || '#0F766E',
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
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-3">
      <h1 className="text-2xl font-bold">Apariencia</h1>
      {(['name', 'tagline', 'logoUrl', 'bannerUrl', 'primaryColor'] as const).map((key) => (
        <label key={key} className="block text-sm capitalize">
          {key}
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={form[key]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        </label>
      ))}
      <label className="block text-sm">
        Intro home
        <textarea
          className="mt-1 w-full rounded border px-3 py-2"
          rows={3}
          value={form.homeIntro}
          onChange={(e) => setForm((f) => ({ ...f, homeIntro: e.target.value }))}
        />
      </label>
      <button type="submit" className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">
        Guardar
      </button>
    </form>
  );
}
