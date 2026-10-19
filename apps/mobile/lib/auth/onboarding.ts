import { isClub, isPlayer } from '@/lib/roles';

type OnboardingUser = {
  role?: string;
  name?: string | null;
  nickname?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  declaredCategory?: string | null;
  preferredHand?: string | null;
  courtPosition?: string | null;
};

function hasText(value?: string | null): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Un jugador necesita onboarding si le faltan datos obligatorios de los pasos 1–2
 * (amigos del paso 3 es opcional).
 */
export function needsPlayerOnboarding(user?: OnboardingUser | null): boolean {
  if (!user || !isPlayer(user.role)) return false;

  if (!hasText(user.nickname)) return true;
  if (!hasText(user.birthDate)) return true;
  if (!hasText(user.gender)) return true;
  if (!hasText(user.declaredCategory)) return true;
  if (!hasText(user.preferredHand)) return true;
  if (!hasText(user.courtPosition)) return true;

  return false;
}

/** Ruta post-login / arranque según rol y estado de onboarding. */
export function postAuthRoute(user?: OnboardingUser | null): string {
  if (!user) return '/(auth)/login';
  if (isClub(user.role)) return '/(tabs)/gerente';
  if (needsPlayerOnboarding(user)) return '/onboarding';
  return '/(tabs)/home';
}
