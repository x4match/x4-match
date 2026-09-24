'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, MapPin, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import {
  type ClubLocationValue,
  type GeocodeHit,
  emptyClubLocation,
  enrichClubLocation,
  osmEmbedUrl,
} from '@/lib/geocode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type LocationPickerProps = {
  value: ClubLocationValue;
  onChange: (value: ClubLocationValue) => void;
  className?: string;
  compact?: boolean;
  requiredHint?: boolean;
};

export function LocationPicker({
  value,
  onChange,
  className,
  compact = false,
  requiredHint = false,
}: LocationPickerProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(value.label || value.address || '');
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const next = value.label || [value.address, value.city].filter(Boolean).join(', ');
    setQuery((prev) => (prev === next ? prev : next));
  }, [value.label, value.address, value.city]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setHits([]);
      setSearching(false);
      return;
    }

    // Don't re-search when the query already matches the selected location label.
    if (value.label && q === value.label.trim() && value.latitude != null) {
      setHits([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results?: GeocodeHit[]; message?: string };
        if (cancelled) return;
        if (!res.ok) {
          toast.error(data.message || 'No se pudo buscar la ubicación');
          setHits([]);
          return;
        }
        setHits(data.results || []);
        setOpen(true);
      } catch {
        if (!cancelled) {
          toast.error('Error al buscar la ubicación');
          setHits([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, value.label, value.latitude]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const applyHit = (hit: GeocodeHit) => {
    const next = enrichClubLocation({
      city: hit.city,
      address: hit.address,
      label: hit.label,
      latitude: hit.latitude,
      longitude: hit.longitude,
    });
    onChange(next);
    setQuery(next.label || [next.address, next.city].filter(Boolean).join(', '));
    setHits([]);
    setOpen(false);
  };

  const useMyLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }

    setLocating(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60_000,
        });
      });

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const res = await fetch(
        `/api/geocode/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}`,
      );
      const data = (await res.json()) as { result?: GeocodeHit; message?: string };
      if (!res.ok || !data.result) {
        onChange({
          ...emptyClubLocation(),
          label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          latitude: lat,
          longitude: lon,
        });
        setQuery(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        toast.message('Ubicación capturada', {
          description: 'No pudimos completar la dirección; revisá ciudad y dirección a mano.',
        });
        return;
      }

      applyHit({
        ...data.result,
        latitude: data.result.latitude ?? lat,
        longitude: data.result.longitude ?? lon,
      });
      toast.success('Ubicación integrada');
    } catch (err) {
      const code = (err as GeolocationPositionError | undefined)?.code;
      if (code === 1) toast.error('Permití el acceso a la ubicación en el navegador');
      else if (code === 3) toast.error('Se agotó el tiempo para obtener la ubicación');
      else toast.error('No se pudo obtener tu ubicación');
    } finally {
      setLocating(false);
    }
  };

  const hasCoords = value.latitude != null && value.longitude != null;
  const summary = [value.address, value.city].filter(Boolean).join(' · ');

  return (
    <div ref={wrapRef} className={cn('space-y-3', className)}>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>Ubicación del club</Label>
          {requiredHint ? (
            <span className="text-xs text-muted-foreground">Buscá o usá tu GPS</span>
          ) : null}
        </div>
        <div className={cn('flex gap-2', compact ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row')}>
          <div className="relative min-w-0 flex-1">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (value.latitude != null || value.city || value.address) {
                  onChange({
                    ...value,
                    label: e.target.value,
                    // Clear coords until they pick a suggestion again.
                    latitude: null,
                    longitude: null,
                  });
                }
              }}
              onFocus={() => {
                if (hits.length) setOpen(true);
              }}
              placeholder="Buscar dirección, barrio o ciudad…"
              className="rounded-xl pl-9"
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              autoComplete="off"
            />
            {searching ? (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
            {open && hits.length > 0 ? (
              <ul
                id={listId}
                className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg"
              >
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => applyHit(hit)}
                    >
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">
                          {hit.address || hit.city || 'Ubicación'}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                          {hit.label}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 rounded-xl"
            onClick={() => void useMyLocation()}
            disabled={locating}
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Navigation className="size-4" />
            )}
            Usar mi ubicación
          </Button>
        </div>
      </div>

      {hasCoords ? (
        <div className="overflow-hidden rounded-xl border border-border">
          <iframe
            title="Mapa del club"
            src={osmEmbedUrl(value.latitude!, value.longitude!)}
            className="h-44 w-full border-0 bg-muted"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          {summary ? (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">{summary}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Ciudad</Label>
          <Input
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            placeholder="Se completa al elegir ubicación"
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Dirección</Label>
          <Input
            value={value.address}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            placeholder="Calle y número"
            className="rounded-xl"
          />
        </div>
      </div>
    </div>
  );
}
