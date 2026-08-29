export type RevenueMovement = {
  id: string;
  kind: 'deposit' | 'shop' | string;
  label: string;
  userName: string;
  amount: number;
  status: string;
  occurredAt: string;
  matchId?: string | null;
  provider?: string | null;
  checkoutUrl?: string | null;
  providerPaymentId?: string | null;
  matchDate?: string | null;
  courtLabel?: string | null;
};

export type ClubRevenueSummary = {
  totalCollected: number;
  totalPending: number;
  collectedDeposits: number;
  collectedShop: number;
  pendingDeposits: number;
  pendingShop: number;
  depositCount: number;
  shopSaleCount: number;
};

export type ClubRevenueResponse = {
  summary: ClubRevenueSummary;
  recent: RevenueMovement[];
  periodDays: number;
};

function csvEscape(value: string | number): string {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function movementKindLabel(kind: string): string {
  return kind === 'shop' ? 'Tienda' : 'Seña';
}

function movementStatusLabel(status: string): string {
  if (status === 'APPROVED' || status === 'CONFIRMED') return 'Cobrado';
  if (status === 'PENDING') return 'Pendiente';
  return status;
}

export function buildRevenueCsv(params: {
  clubName: string;
  periodDays: number;
  summary: ClubRevenueSummary;
  movements: RevenueMovement[];
}): string {
  const { clubName, periodDays, summary, movements } = params;
  const lines = [
    `Club,${csvEscape(clubName)}`,
    `Período (días),${periodDays}`,
    `Total cobrado,${summary.totalCollected}`,
    `Total pendiente,${summary.totalPending}`,
    `Señas cobradas,${summary.collectedDeposits}`,
    `Tienda cobrada,${summary.collectedShop}`,
    '',
    'Fecha,Tipo,Concepto,Jugador,Monto,Estado,Provider,MatchId,Cancha',
    ...movements.map((item) =>
      [
        csvEscape(item.occurredAt),
        csvEscape(movementKindLabel(item.kind)),
        csvEscape(item.label),
        csvEscape(item.userName),
        item.amount,
        csvEscape(movementStatusLabel(item.status)),
        csvEscape(item.provider || ''),
        csvEscape(item.matchId || ''),
        csvEscape(item.courtLabel || ''),
      ].join(','),
    ),
  ];
  return lines.join('\n');
}

export function downloadRevenueCsv(params: {
  clubName: string;
  periodDays: number;
  summary: ClubRevenueSummary;
  movements: RevenueMovement[];
}) {
  const csv = buildRevenueCsv(params);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `facturacion-${params.clubName.replace(/\s+/g, '-').toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function isMovementCollected(status: string): boolean {
  return status === 'APPROVED' || status === 'CONFIRMED';
}
