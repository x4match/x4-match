import type { BriefingAction } from './club-manager';

export function briefingActionHref(
  action: BriefingAction | undefined,
): string | null {
  if (!action) return null;
  if (action.type === 'billing') return '/facturacion';
  if (action.type === 'payments') return '/pagos';
  if (action.type === 'clients') return '/clientes';
  if (action.type === 'alerts') return '/alertas';
  if (action.type === 'shop') {
    const tab = action.tab || 'stats';
    return `/tienda?tab=${tab}`;
  }
  if (action.type === 'auto_fill') return '/gestion?tab=stats&autofill=1';
  if (action.type === 'court_slots') {
    const params = new URLSearchParams();
    params.set('tab', action.tab || 'stats');
    if (action.dayOfWeek != null) params.set('dayOfWeek', String(action.dayOfWeek));
    if (action.hourBucket != null) params.set('hourBucket', String(action.hourBucket));
    return `/gestion?${params.toString()}`;
  }
  return null;
}
