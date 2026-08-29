import { Share } from 'react-native';
import { formatFullDate } from '@/lib/format';

export type RevenueMovement = {
  id: string;
  kind: 'deposit' | 'shop' | string;
  label: string;
  userName: string;
  amount: number;
  status: string;
  occurredAt: string;
  checkoutUrl?: string | null;
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
    'Fecha,Tipo,Concepto,Jugador,Monto,Estado',
    ...movements.map((item) =>
      [
        csvEscape(formatFullDate(item.occurredAt)),
        csvEscape(movementKindLabel(item.kind)),
        csvEscape(item.label),
        csvEscape(item.userName),
        item.amount,
        csvEscape(movementStatusLabel(item.status)),
      ].join(','),
    ),
  ];
  return lines.join('\n');
}

export async function shareRevenueCsv(params: {
  clubName: string;
  periodDays: number;
  summary: ClubRevenueSummary;
  movements: RevenueMovement[];
}): Promise<void> {
  const csv = buildRevenueCsv(params);
  await Share.share({
    message: csv,
    title: `Facturación ${params.clubName}`,
  });
}

export function isMovementCollected(status: string): boolean {
  return status === 'APPROVED' || status === 'CONFIRMED';
}
