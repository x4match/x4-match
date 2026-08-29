import type { Router } from 'expo-router';
import type { BriefingAction } from '@/lib/club-manager';

type RunManagerActionOptions = {
  router: Router;
  clubId: string | null;
  clubName?: string;
  enableAutoFill?: () => void;
};

export function runManagerAction(
  action: BriefingAction | undefined,
  opts: RunManagerActionOptions,
) {
  if (!action) return;
  const { router, clubId, clubName, enableAutoFill } = opts;

  if (action.type === 'billing') {
    router.push({
      pathname: '/club-billing',
      params: { clubId: clubId || '', clubName: clubName || '' },
    } as any);
    return;
  }
  if (action.type === 'payments') {
    router.push({
      pathname: '/club-payments',
      params: { clubId: clubId || '', clubName: clubName || '' },
    } as any);
    return;
  }
  if (action.type === 'clients') {
    router.push({
      pathname: '/club-clients',
      params: { clubId: clubId || '', clubName: clubName || '' },
    } as any);
    return;
  }
  if (action.type === 'alerts') {
    router.push({
      pathname: '/club-alerts',
      params: { clubId: clubId || '', clubName: clubName || '' },
    } as any);
    return;
  }
  if (action.type === 'shop') {
    router.push({
      pathname: '/(tabs)/shop',
      params: { tab: action.tab || 'stats' },
    } as any);
    return;
  }
  if (action.type === 'auto_fill') {
    enableAutoFill?.();
    router.push({ pathname: '/(tabs)/court-slots', params: { tab: 'stats' } } as any);
    return;
  }
  if (action.type === 'court_slots') {
    const params: Record<string, string> = { tab: action.tab || 'stats' };
    if (action.dayOfWeek != null) params.dayOfWeek = String(action.dayOfWeek);
    if (action.hourBucket != null) params.hourBucket = String(action.hourBucket);
    router.push({ pathname: '/(tabs)/court-slots', params } as any);
  }
}
