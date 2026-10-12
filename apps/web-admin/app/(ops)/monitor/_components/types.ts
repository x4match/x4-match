export type MonitorTotals = {
  users: number;
  clubs: number;
  matches: number;
  tournaments: number;
  activeTrials: number;
  trialsExpiring7d: number;
  mpConnectedClubs: number;
  pendingClubRegistrations: number;
};

export type MonitorData = {
  generatedAt: string;
  totals: MonitorTotals;
  billingBreakdown: { status: string; count: number }[];
  recentClubs: { id: string; name: string; city?: string | null; createdAt: string; billingStatus: string }[];
  recentUsers: { id: string; name: string; email: string; role: string; createdAt: string }[];
};

export type TrendWeek = {
  weekStart: string;
  users: number;
  clubs: number;
  matches: number;
  tournaments: number;
  revenue: number;
};

export type TrendsData = { generatedAt: string; weeks: TrendWeek[] };

export type TrendSeries = 'users' | 'clubs' | 'matches' | 'tournaments';
