'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useSponsor } from '@/contexts/SponsorContext';
import { PageShell, PanelCard, StatusPill } from '@/components/layout/PageShell';

export default function AjustesPage() {
  const { user } = useAuth();
  const { activeSponsor } = useSponsor();

  return (
    <PageShell
      kicker="Cuenta"
      title="Ajustes"
      description="Información de la sesión y la tienda activa."
      narrow
    >
      <PanelCard title="Usuario">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Nombre</dt>
            <dd className="font-semibold">{user?.name || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-semibold">{user?.email || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Rol</dt>
            <dd>
              <StatusPill>{user?.role || '—'}</StatusPill>
            </dd>
          </div>
        </dl>
      </PanelCard>
      <PanelCard title="Partner activo">
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Nombre</dt>
            <dd className="font-semibold">{activeSponsor?.name || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="font-mono text-xs font-semibold">{activeSponsor?.slug || '—'}</dd>
          </div>
        </dl>
      </PanelCard>
    </PageShell>
  );
}
