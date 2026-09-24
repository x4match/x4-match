'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useSponsor } from '@/contexts/SponsorContext';

export default function AjustesPage() {
  const { user } = useAuth();
  const { activeSponsor } = useSponsor();
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Ajustes</h1>
      <p className="text-sm text-slate-600">Usuario: {user?.name} ({user?.email})</p>
      <p className="text-sm text-slate-600">
        Partner activo: {activeSponsor?.name} · slug {activeSponsor?.slug}
      </p>
    </div>
  );
}
