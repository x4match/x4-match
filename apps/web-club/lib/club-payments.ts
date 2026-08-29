export type ClubPaymentStatus =
  | 'DISCONNECTED'
  | 'CONNECTED'
  | 'EXPIRED'
  | 'MANUAL_ONLY';

export type ClubPaymentConfigStatus = {
  clubId: string;
  status: ClubPaymentStatus;
  mpUserId: string | null;
  connectedAt: string | null;
  canCheckoutOnline: boolean;
  oauthConfigured: boolean;
  mockConnectAvailable: boolean;
  usesPlatformFallback: boolean;
};

export function clubPaymentStatusLabel(status: ClubPaymentStatus): string {
  switch (status) {
    case 'CONNECTED':
      return 'Conectado';
    case 'EXPIRED':
      return 'Sesión expirada';
    case 'MANUAL_ONLY':
      return 'Cobro manual';
    default:
      return 'Sin conectar';
  }
}

export function clubPaymentStatusTone(
  status: ClubPaymentStatus,
): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'CONNECTED':
      return 'success';
    case 'EXPIRED':
      return 'danger';
    case 'MANUAL_ONLY':
      return 'warning';
    default:
      return 'default';
  }
}
