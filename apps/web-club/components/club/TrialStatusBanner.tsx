'use client';

import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import {
  trialModeLabel,
  trialStatusLabel,
  type ClubTrialStatus,
} from '@/lib/club-trial';
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
                  : ' El equipo de x4 match tiene que iniciar el período de prueba para activar el club.'}
              </p>
            </div>
          </div>
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

export function TrialSubscriptionCard({ trial }: { trial: ClubTrialStatus | undefined }) {
  if (!trial) return null;

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="font-semibold">Suscripción x4 match</p>
        <p className="text-sm text-muted-foreground">
          {trialStatusLabel(trial.status)} · {trialModeLabel(trial.trialMode)}
        </p>
        {trial.isTrialActive && trial.daysRemaining != null ? (
          <p className="text-sm text-muted-foreground">
            {trial.daysRemaining} días restantes
            {trial.trialEndsAt
              ? ` · vence ${new Date(trial.trialEndsAt).toLocaleDateString('es-AR')}`
              : ''}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
