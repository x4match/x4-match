export type BriefingSeverity =
  | 'info'
  | 'warn'
  | 'action'
  | 'critical'
  | 'success'
  | 'opportunity';

export type BriefingAction =
  | {
      type: 'court_slots';
      tab?: 'promotions' | 'stats' | 'slots' | 'courts';
      dayOfWeek?: number;
      hourBucket?: number;
    }
  | { type: 'billing' }
  | { type: 'payments' }
  | { type: 'auto_fill' }
  | { type: 'clients' }
  | { type: 'alerts' }
  | {
      type: 'shop';
      tab?: 'stats' | 'products' | 'matchExtras' | 'coupons' | 'redemptions';
    };

export type BriefingCard = {
  id: string;
  severity: BriefingSeverity;
  title: string;
  body: string;
  actionLabel?: string;
  action?: BriefingAction;
};

export type AlertPriority = 'critical' | 'warn' | 'info' | 'success';

export type ManagerAlert = {
  id: string;
  priority: AlertPriority;
  title: string;
  body: string;
  actionLabel?: string;
  action?: BriefingAction;
};

export type ManagerKpiTile = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  tone?: 'primary' | 'accent' | 'default';
  statusTone?: 'success' | 'warning' | 'danger' | 'default';
};

export type ManagerCourtRow = {
  courtId: string | null;
  courtLabel: string;
  detail: string;
  revenueLabel: string;
};

export type ManagerAtRiskPlayer = {
  userId: string;
  name: string;
  nickname?: string | null;
  photoUrl?: string | null;
  detail: string;
};

export type ManagerValleyRow = {
  id: string;
  title: string;
  detail: string;
  freeHours?: number;
  lostRevenue?: number;
  lostRevenueLabel?: string;
  dayOfWeek?: number;
  hourBucket?: number;
  action?: ManagerSectionAction;
};

export type ManagerSectionAction = {
  label: string;
  action: BriefingAction;
};

export type ManagerComparisonMetric = {
  id: string;
  label: string;
  vsYesterdayPct: number;
  vsWeekPct: number;
  vsMonthPct: number;
};

export type ManagerUpcomingSlot = {
  id: string;
  timeLabel: string;
  courtLabel: string;
  playerLabel: string;
  status: 'OPEN' | 'BOOKED' | string;
};

export type ManagerClientRow = {
  userId: string;
  name: string;
  nickname?: string | null;
  photoUrl?: string | null;
  matchesAtClub: number;
  lastPlayedAt?: string | null;
  daysSince?: number | null;
  spent: number;
  debt: number;
};

export type ManagerReport = {
  clubId: string;
  clubName: string;
  periodDays: number;
  generatedAt: string;
  autoFillGapsEnabled: boolean;
  alertCount: number;
  intro: string;
  hero: {
    title: string;
    amount: number;
    amountLabel: string;
    deltaPct: number;
    deltaLabel: string;
    hint?: string;
    tone: 'success' | 'danger' | 'default';
  };
  comparisons: {
    title: string;
    metrics: ManagerComparisonMetric[];
  };
  today: {
    title: string;
    subtitle: string;
    tiles: ManagerKpiTile[];
  };
  briefing: {
    title: string;
    subtitle: string;
    emptyText: string;
    cards: BriefingCard[];
  };
  insights: {
    title: string;
    subtitle: string;
    emptyText: string;
    cards: BriefingCard[];
  };
  upcomingSlots: {
    title: string;
    subtitle: string;
    emptyText: string;
    rows: ManagerUpcomingSlot[];
    action?: ManagerSectionAction;
  };
  byCourt: {
    title: string;
    subtitle: string;
    emptyText: string;
    rows: ManagerCourtRow[];
  };
  atRisk: {
    title: string;
    subtitle: string;
    emptyText: string;
    rows: ManagerAtRiskPlayer[];
    moreLabel?: string;
    action?: ManagerSectionAction;
  };
  cancellations: {
    title: string;
    subtitle: string;
    refundedLabel: string;
    refundedAmount: string;
    refundedDetail: string;
    retainedLabel: string;
    retainedAmount: string;
    retainedDetail: string;
    summary: string;
    action?: ManagerSectionAction;
  };
  deadHours: {
    title: string;
    subtitle: string;
    emptyText: string;
    rows: ManagerValleyRow[];
    action?: ManagerSectionAction;
  };
  alerts: {
    title: string;
    subtitle: string;
    emptyText: string;
    rows: ManagerAlert[];
  };
  clientsSummary: {
    title: string;
    subtitle: string;
    counts: {
      new: number;
      frequent: number;
      inactive: number;
      top: number;
    };
    segments: {
      new: ManagerClientRow[];
      frequent: ManagerClientRow[];
      inactive: ManagerClientRow[];
      top: ManagerClientRow[];
    };
    action?: ManagerSectionAction;
  };
};
