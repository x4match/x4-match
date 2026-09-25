'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSponsor } from '@/contexts/SponsorContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/PageShell';
import { FormSection } from '@/components/layout/FormSection';
import {
  DEFAULT_THEME,
  FONT_OPTIONS,
  THEME_PRESETS,
  resolveStoreTheme,
  type StoreTheme,
} from '@/lib/store-theme';
import { cn } from '@/lib/utils';

type FormState = {
  name: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bannerUrl: string;
  logoUrl: string;
  faviconUrl: string;
  homeIntro: string;
  storeTheme: StoreTheme;
};

const emptyForm = (): FormState => ({
  name: '',
  tagline: '',
  primaryColor: DEFAULT_THEME.primaryColor,
  secondaryColor: DEFAULT_THEME.secondaryColor,
  accentColor: DEFAULT_THEME.accentColor,
  bannerUrl: '',
  logoUrl: '',
  faviconUrl: '',
  homeIntro: '',
  storeTheme: { ...DEFAULT_THEME },
});

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          className="min-h-11"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="color"
          aria-label={label}
          className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-transparent p-1"
          value={/^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#03ac0e'}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-3 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        className="size-4 accent-[var(--primary)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export default function AparienciaPage() {
  const { activeSponsorId, refetchSponsors } = useSponsor();
  const qc = useQueryClient();
  const sponsorQ = useQuery({
    queryKey: ['partner-sponsor', activeSponsorId],
    queryFn: async () => (await api.get(`/sponsors/me/${activeSponsorId}`)).data,
    enabled: !!activeSponsorId,
  });
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    const s = sponsorQ.data;
    if (!s) return;
    const theme = resolveStoreTheme(s);
    setForm({
      name: s.name || '',
      tagline: s.tagline || '',
      primaryColor: s.primary_color || theme.primaryColor,
      secondaryColor: s.secondary_color || theme.secondaryColor,
      accentColor: s.accent_color || theme.accentColor,
      bannerUrl: s.banner_url || '',
      logoUrl: s.logo_url || '',
      faviconUrl: s.favicon_url || theme.faviconUrl || '',
      homeIntro: s.home_intro || '',
      storeTheme: {
        secondaryColor: theme.secondaryColor,
        accentColor: theme.accentColor,
        backgroundColor: theme.backgroundColor,
        surfaceColor: theme.surfaceColor,
        textColor: theme.textColor,
        mutedTextColor: theme.mutedTextColor,
        fontFamily: theme.fontFamily,
        heroStyle: theme.heroStyle,
        productGridCols: theme.productGridCols,
        cardStyle: theme.cardStyle,
        cornerRadius: theme.cornerRadius,
        headerStyle: theme.headerStyle,
        colorMode: theme.colorMode,
        showCategories: theme.showCategories,
        showOffers: theme.showOffers,
        showSearch: theme.showSearch,
        showTagline: theme.showTagline,
        ctaLabel: theme.ctaLabel,
        heroOverlay: theme.heroOverlay,
        faviconUrl: theme.faviconUrl,
        heroHeadline: theme.heroHeadline,
        footerText: theme.footerText,
      },
    });
  }, [sponsorQ.data]);

  const patchTheme = (patch: Partial<StoreTheme>) =>
    setForm((f) => ({ ...f, storeTheme: { ...f.storeTheme, ...patch } }));

  const applyPreset = (presetId: string) => {
    const preset = THEME_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const { primaryColor, ...rest } = preset.patch;
    setForm((f) => ({
      ...f,
      primaryColor: primaryColor || f.primaryColor,
      secondaryColor: rest.secondaryColor || f.secondaryColor,
      accentColor: rest.accentColor || f.accentColor,
      storeTheme: { ...f.storeTheme, ...rest },
    }));
  };

  const save = useMutation({
    mutationFn: async () =>
      api.patch(`/sponsors/me/${activeSponsorId}`, {
        name: form.name,
        tagline: form.tagline,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        accentColor: form.accentColor,
        bannerUrl: form.bannerUrl || undefined,
        logoUrl: form.logoUrl || undefined,
        faviconUrl: form.faviconUrl || undefined,
        homeIntro: form.homeIntro,
        storeTheme: {
          ...form.storeTheme,
          secondaryColor: form.secondaryColor,
          accentColor: form.accentColor,
          faviconUrl: form.faviconUrl || undefined,
        },
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

  const previewTheme = useMemo(
    () =>
      resolveStoreTheme({
        primary_color: form.primaryColor,
        secondary_color: form.secondaryColor,
        accent_color: form.accentColor,
        store_theme: form.storeTheme,
      }),
    [form],
  );

  const overlay = Math.round((previewTheme.heroOverlay || 0.5) * 100);

  return (
    <PageShell
      kicker="Tienda"
      title="Apariencia"
      description="Personalizá colores, tipografía, layout y contenido de tu tienda."
      actions={
        <Button
          type="submit"
          form="apariencia-form"
          className="min-h-11 font-bold"
          disabled={save.isPending}
        >
          {save.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      }
    >
      <form id="apariencia-form" onSubmit={onSubmit} className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <FormSection title="Presets rápidos" description="Partí de un look y ajustalo">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {THEME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className="rounded-xl border border-border bg-surface-2 p-3 text-left transition-colors hover:border-primary/40"
                >
                  <div className="mb-2 flex gap-1">
                    {[p.patch.primaryColor, p.patch.accentColor, p.patch.backgroundColor].map(
                      (c, i) => (
                        <span
                          key={i}
                          className="size-5 rounded-full border border-border"
                          style={{ background: c }}
                        />
                      ),
                    )}
                  </div>
                  <p className="text-sm font-bold">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </button>
              ))}
            </div>
          </FormSection>

          <Tabs defaultValue="brand">
            <TabsList className="flex h-auto flex-wrap gap-1">
              <TabsTrigger value="brand">Marca</TabsTrigger>
              <TabsTrigger value="colors">Colores</TabsTrigger>
              <TabsTrigger value="layout">Layout</TabsTrigger>
              <TabsTrigger value="content">Contenido</TabsTrigger>
            </TabsList>

            <TabsContent value="brand" className="mt-4 space-y-4">
              <FormSection>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre de tienda</Label>
                    <Input
                      id="name"
                      className="min-h-11"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Input
                      id="tagline"
                      className="min-h-11"
                      value={form.tagline}
                      onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logoUrl">URL del logo</Label>
                    <Input
                      id="logoUrl"
                      className="min-h-11"
                      value={form.logoUrl}
                      onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bannerUrl">URL del banner / hero</Label>
                    <Input
                      id="bannerUrl"
                      className="min-h-11"
                      value={form.bannerUrl}
                      onChange={(e) => setForm((f) => ({ ...f, bannerUrl: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="faviconUrl">Favicon URL</Label>
                    <Input
                      id="faviconUrl"
                      className="min-h-11"
                      value={form.faviconUrl}
                      onChange={(e) => setForm((f) => ({ ...f, faviconUrl: e.target.value }))}
                    />
                  </div>
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
                </div>
              </FormSection>
            </TabsContent>

            <TabsContent value="colors" className="mt-4 space-y-4">
              <FormSection title="Paleta">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField
                    id="primary"
                    label="Primario (CTAs)"
                    value={form.primaryColor}
                    onChange={(v) => setForm((f) => ({ ...f, primaryColor: v }))}
                  />
                  <ColorField
                    id="secondary"
                    label="Secundario"
                    value={form.secondaryColor}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, secondaryColor: v }));
                      patchTheme({ secondaryColor: v });
                    }}
                  />
                  <ColorField
                    id="accent"
                    label="Acento"
                    value={form.accentColor}
                    onChange={(v) => {
                      setForm((f) => ({ ...f, accentColor: v }));
                      patchTheme({ accentColor: v });
                    }}
                  />
                  <ColorField
                    id="bg"
                    label="Fondo"
                    value={form.storeTheme.backgroundColor || DEFAULT_THEME.backgroundColor}
                    onChange={(v) => patchTheme({ backgroundColor: v })}
                  />
                  <ColorField
                    id="surface"
                    label="Superficie / cards"
                    value={form.storeTheme.surfaceColor || DEFAULT_THEME.surfaceColor}
                    onChange={(v) => patchTheme({ surfaceColor: v })}
                  />
                  <ColorField
                    id="text"
                    label="Texto"
                    value={form.storeTheme.textColor || DEFAULT_THEME.textColor}
                    onChange={(v) => patchTheme({ textColor: v })}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <Label>Modo de color</Label>
                  <div className="flex flex-wrap gap-2">
                    {(['light', 'dark', 'brand'] as const).map((m) => (
                      <Button
                        key={m}
                        type="button"
                        size="sm"
                        variant={form.storeTheme.colorMode === m ? 'default' : 'outline'}
                        onClick={() => patchTheme({ colorMode: m })}
                      >
                        {m}
                      </Button>
                    ))}
                  </div>
                </div>
              </FormSection>
            </TabsContent>

            <TabsContent value="layout" className="mt-4 space-y-4">
              <FormSection title="Composición">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tipografía</Label>
                    <select
                      className="min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                      value={form.storeTheme.fontFamily || 'jakarta'}
                      onChange={(e) =>
                        patchTheme({ fontFamily: e.target.value as StoreTheme['fontFamily'] })
                      }
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estilo del hero</Label>
                    <div className="flex flex-wrap gap-2">
                      {(['full-bleed', 'split', 'minimal', 'banner-only'] as const).map((h) => (
                        <Button
                          key={h}
                          type="button"
                          size="sm"
                          variant={form.storeTheme.heroStyle === h ? 'default' : 'outline'}
                          onClick={() => patchTheme({ heroStyle: h })}
                        >
                          {h}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Header</Label>
                    <div className="flex flex-wrap gap-2">
                      {(['blur', 'solid', 'transparent'] as const).map((h) => (
                        <Button
                          key={h}
                          type="button"
                          size="sm"
                          variant={form.storeTheme.headerStyle === h ? 'default' : 'outline'}
                          onClick={() => patchTheme({ headerStyle: h })}
                        >
                          {h}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cards de producto</Label>
                    <div className="flex flex-wrap gap-2">
                      {(['soft', 'bordered', 'flat', 'shadow'] as const).map((c) => (
                        <Button
                          key={c}
                          type="button"
                          size="sm"
                          variant={form.storeTheme.cardStyle === c ? 'default' : 'outline'}
                          onClick={() => patchTheme({ cardStyle: c })}
                        >
                          {c}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Columnas del grid</Label>
                    <div className="flex gap-2">
                      {([2, 3, 4] as const).map((n) => (
                        <Button
                          key={n}
                          type="button"
                          size="sm"
                          variant={form.storeTheme.productGridCols === n ? 'default' : 'outline'}
                          onClick={() => patchTheme({ productGridCols: n })}
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Radio de esquinas</Label>
                    <div className="flex flex-wrap gap-2">
                      {(['none', 'sm', 'md', 'lg', 'xl'] as const).map((r) => (
                        <Button
                          key={r}
                          type="button"
                          size="sm"
                          variant={form.storeTheme.cornerRadius === r ? 'default' : 'outline'}
                          onClick={() => patchTheme({ cornerRadius: r })}
                        >
                          {r}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overlay">Opacidad overlay hero ({overlay}%)</Label>
                    <input
                      id="overlay"
                      type="range"
                      min={0}
                      max={80}
                      value={overlay}
                      className="w-full accent-[var(--primary)]"
                      onChange={(e) => patchTheme({ heroOverlay: Number(e.target.value) / 100 })}
                    />
                  </div>
                </div>
              </FormSection>
            </TabsContent>

            <TabsContent value="content" className="mt-4 space-y-4">
              <FormSection title="Qué mostrar">
                <div className="space-y-2">
                  <Toggle
                    label="Barra de búsqueda"
                    checked={!!form.storeTheme.showSearch}
                    onChange={(v) => patchTheme({ showSearch: v })}
                  />
                  <Toggle
                    label="Carrusel de categorías"
                    checked={!!form.storeTheme.showCategories}
                    onChange={(v) => patchTheme({ showCategories: v })}
                  />
                  <Toggle
                    label="Sección de ofertas"
                    checked={!!form.storeTheme.showOffers}
                    onChange={(v) => patchTheme({ showOffers: v })}
                  />
                  <Toggle
                    label="Mostrar tagline en hero"
                    checked={!!form.storeTheme.showTagline}
                    onChange={(v) => patchTheme({ showTagline: v })}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="cta">Texto del CTA principal</Label>
                  <Input
                    id="cta"
                    className="min-h-11"
                    value={form.storeTheme.ctaLabel || ''}
                    onChange={(e) => patchTheme({ ctaLabel: e.target.value })}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="headline">Headline custom (opcional)</Label>
                  <Input
                    id="headline"
                    className="min-h-11"
                    placeholder="Dejá vacío para usar el nombre de la tienda"
                    value={form.storeTheme.heroHeadline || ''}
                    onChange={(e) => patchTheme({ heroHeadline: e.target.value })}
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="footer">Texto del footer</Label>
                  <Input
                    id="footer"
                    className="min-h-11"
                    placeholder="Powered by x4 match"
                    value={form.storeTheme.footerText || ''}
                    onChange={(e) => patchTheme({ footerText: e.target.value })}
                  />
                </div>
              </FormSection>
            </TabsContent>
          </Tabs>
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <FormSection title="Live preview" description="Así se ve el hero en tu tienda">
            <div
              className={cn(
                'overflow-hidden border text-sm',
                previewTheme.cornerRadius === 'none' ? 'rounded-none' : 'rounded-2xl',
              )}
              style={{
                background: previewTheme.backgroundColor,
                color: previewTheme.textColor,
                borderColor:
                  previewTheme.colorMode === 'dark'
                    ? 'rgba(255,255,255,0.12)'
                    : 'rgba(0,0,0,0.08)',
              }}
            >
              <div
                className="flex items-center justify-between gap-2 border-b px-3 py-2"
                style={{
                  background:
                    previewTheme.headerStyle === 'solid'
                      ? previewTheme.surfaceColor
                      : `${previewTheme.surfaceColor}cc`,
                  borderColor: 'inherit',
                }}
              >
                <div className="flex items-center gap-2">
                  {form.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logoUrl} alt="" className="size-7 rounded-lg object-cover" />
                  ) : (
                    <span
                      className="flex size-7 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                      style={{ background: form.primaryColor }}
                    >
                      {(form.name || 'T').slice(0, 1)}
                    </span>
                  )}
                  <span className="truncate text-xs font-bold">{form.name || 'Tu tienda'}</span>
                </div>
                <span
                  className="rounded-full px-2 py-1 text-[10px] font-bold text-white"
                  style={{ background: form.primaryColor }}
                >
                  Carrito
                </span>
              </div>

              <div
                className={cn(
                  'p-5 text-white',
                  previewTheme.heroStyle === 'minimal' && 'py-8',
                  previewTheme.heroStyle === 'split' && 'grid gap-3 sm:grid-cols-2',
                )}
                style={{
                  background: form.bannerUrl
                    ? `linear-gradient(rgba(0,0,0,${previewTheme.heroOverlay}), rgba(0,0,0,${previewTheme.heroOverlay})), url(${form.bannerUrl}) center/cover`
                    : `linear-gradient(135deg, ${form.primaryColor} 0%, ${previewTheme.colorMode === 'dark' ? '#000' : '#0b1220'} 100%)`,
                  minHeight: previewTheme.heroStyle === 'banner-only' ? 120 : 180,
                }}
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                    Tienda oficial
                  </p>
                  <p className="mt-1 text-xl font-extrabold tracking-tight">
                    {form.storeTheme.heroHeadline || form.name || 'Tu tienda'}
                  </p>
                  {previewTheme.showTagline ? (
                    <p className="mt-1 text-xs text-white/90">{form.tagline || 'Tagline'}</p>
                  ) : null}
                  <p className="mt-2 line-clamp-2 text-xs text-white/80">
                    {form.homeIntro || 'Introducción de la home'}
                  </p>
                  <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-900">
                    {previewTheme.ctaLabel}
                  </span>
                </div>
                {previewTheme.heroStyle === 'split' ? (
                  <div className="rounded-xl bg-white/10 p-3 text-[10px] text-white/80">
                    Panel lateral / promo
                  </div>
                ) : null}
              </div>

              <div className="space-y-2 p-3">
                {previewTheme.showCategories ? (
                  <div className="flex gap-2 overflow-hidden">
                    {['Cat A', 'Cat B', 'Cat C'].map((c) => (
                      <span
                        key={c}
                        className="shrink-0 rounded-lg border px-2 py-1 text-[10px] font-semibold"
                        style={{
                          borderColor: 'inherit',
                          background: previewTheme.surfaceColor,
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div
                  className={cn(
                    'grid gap-2',
                    previewTheme.productGridCols === 2 && 'grid-cols-2',
                    previewTheme.productGridCols === 3 && 'grid-cols-3',
                    previewTheme.productGridCols === 4 && 'grid-cols-4',
                  )}
                >
                  {Array.from({ length: Math.min(previewTheme.productGridCols, 4) }).map((_, i) => (
                    <div
                      key={i}
                      className="overflow-hidden"
                      style={{
                        borderRadius:
                          previewTheme.cornerRadius === 'none'
                            ? 0
                            : previewTheme.cornerRadius === 'sm'
                              ? 6
                              : 12,
                        background: previewTheme.surfaceColor,
                        border:
                          previewTheme.cardStyle === 'flat'
                            ? 'none'
                            : `1px solid ${previewTheme.colorMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                        boxShadow:
                          previewTheme.cardStyle === 'shadow'
                            ? '0 4px 12px rgba(0,0,0,0.12)'
                            : undefined,
                      }}
                    >
                      <div
                        className="aspect-square"
                        style={{ background: previewTheme.secondaryColor }}
                      />
                      <div className="p-1.5">
                        <div
                          className="mb-1 h-2 rounded"
                          style={{ background: previewTheme.mutedTextColor, opacity: 0.3 }}
                        />
                        <div
                          className="h-2 w-1/2 rounded font-bold"
                          style={{ background: form.primaryColor }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FormSection>
        </div>
      </form>
    </PageShell>
  );
}
