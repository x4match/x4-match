'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import {
  trialModeLabel,
  trialStatusLabel,
  type ClubTrialStatus,
} from '@/lib/club-trial';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type TrialStatusBannerProps = {
  trial: ClubTrialStatus | undefined;
  className?: string;
};

export function TrialStatusBanner({ trial, className }: TrialStatusBannerProps) {
  if (!trial) return null;

  if (!trial.isAccessAllowed) {
    const isSuspended = trial.status === 'SUSPENDED' || trial.status === 'CANCELLED';
    return (
      <Card
        className={cn(
          'border-destructive/35 bg-destructive/5',
          className,
        )}
      >
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold">
                {isSuspended ? 'Acceso suspendido' : 'Trial no activo'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Estado: {trialStatusLabel(trial.status)}.
                {isSuspended
                  ? ' Contactá a soporte de x4 match para reactivar el acceso.'
                  : ' Completá el checklist con x4 match para activar los 90 días de prueba.'}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Checklist: {trial.checklist.requiredDone}/{trial.checklist.requiredTotal} requeridos
              </p>
            </div>
          </div>
          {!isSuspended ? (
            <Button asChild variant="outline" className="rounded-xl shrink-0">
              <Link href="/perfil">Ver checklist</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (trial.status === 'GRACE' && trial.daysRemaining != null) {
    return (
      <Card className={cn('border-warning/35 bg-warning/5', className)}>
        <CardContent className="flex gap-3 p-4">
          <Clock className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="font-semibold">Período de gracia</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Te quedan {trial.daysRemaining} días para regularizar el plan con x4 match.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trial.isTrialActive && trial.daysRemaining != null) {
    return (
      <Card className={cn('border-success/30 bg-success/5', className)}>
        <CardContent className="flex gap-3 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <p className="font-semibold">
              Trial activo · {trial.daysRemaining} días restantes
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Modo {trialModeLabel(trial.trialMode)}.
              {trial.trialEndsAt
                ? ` Vence ${new Date(trial.trialEndsAt).toLocaleDateString('es-AR')}.`
                : ''}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

export function TrialChecklistCard({ trial }: { trial: ClubTrialStatus | undefined }) {
  if (!trial) return null;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <p className="font-semibold">Suscripción x4 match</p>
          <p className="text-sm text-muted-foreground">
            {trialStatusLabel(trial.status)} · {trialModeLabel(trial.trialMode)}
          </p>
        </div>
        <div className="space-y-2">
          {trial.checklist.items.map((item) => (
            <div
              key={item.key}
              className="flex items-start justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  item.state.done
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {item.state.done ? 'Listo' : 'Pendiente'}
              </span>
            </div>
          ))}
        </div>
        <Button asChild variant="outline" className="w-full rounded-xl">
          <Link href="/pagos">Configurar Mercado Pago</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
