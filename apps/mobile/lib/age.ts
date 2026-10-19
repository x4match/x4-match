export const MIN_PLAYER_AGE = 10;

/** Edad en años cumplidos a partir de una fecha de nacimiento. */
export function ageFromBirthDate(date: Date | null | undefined): number | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  if (age < 0 || age > 120) return null;
  return age;
}

/** Última fecha de nacimiento permitida para cumplir `minAge` años hoy. */
export function maxBirthDateForMinAge(minAge = MIN_PLAYER_AGE): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - minAge);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isAtLeastMinAge(date: Date | null | undefined, minAge = MIN_PLAYER_AGE): boolean {
  const age = ageFromBirthDate(date);
  return age != null && age >= minAge;
}

export function minAgeErrorMessage(minAge = MIN_PLAYER_AGE): string {
  return `Debés tener al menos ${minAge} años`;
}
