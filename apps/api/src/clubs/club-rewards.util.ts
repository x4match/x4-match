const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Código de retiro legible: X4-XXXXXX (9 chars). */
export function generateRedemptionCode(randomBytes?: () => number): string {
  const rand = randomBytes ?? (() => Math.floor(Math.random() * CODE_ALPHABET.length));
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += CODE_ALPHABET[rand() % CODE_ALPHABET.length];
  }
  return `X4-${suffix}`;
}

export function assertRewardRedeemable(input: {
  active: boolean;
  stock: number | null;
  maxPerUser: number | null;
  userRedemptionCount: number;
  balance: number;
  pointsRequired: number;
}): void {
  if (!input.active) {
    throw new Error('PREMIO_INACTIVO');
  }
  if (input.stock != null && input.stock <= 0) {
    throw new Error('SIN_STOCK');
  }
  if (input.maxPerUser != null && input.userRedemptionCount >= input.maxPerUser) {
    throw new Error('CUPO_EXCEDIDO');
  }
  if (input.balance < input.pointsRequired) {
    throw new Error('SALDO_INSUFICIENTE');
  }
}
