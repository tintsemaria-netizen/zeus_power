export interface Wilson {
  p: number;
  low: number;
  high: number;
  k: number;
  n: number;
}

export interface DashboardData {
  meta: {
    source: string;
    totalRecords: number;
    zeusRecords: number;
    excludedRecords: number;
    playExchanges: number;
    derivedRounds: number;
    generatedNote: string;
  };
  economics: {
    paidSpins: number;
    completedRounds: number;
    wager: number;
    payout: number;
    ggr: number;
    rtp: number;
    avgWinPerSpin: number;
    maxWinXBet: number;
    volatilityXBet: number;
  };
  frequencies: { hit: Wilson; freeSpin: Wilson; bonus: Wilson; fist: Wilson };
  convergence: { i: number; rtp: number; net: number }[];
  histogram: { labels: string[]; counts: number[] };
  actionSets: Record<string, number>;
  transitions: Record<string, number>;
  health: {
    latencyMs: { p50: number; p95: number; p99: number; max: number };
    httpStatus: Record<string, number>;
    appStatus: Record<string, number>;
    parseErrors: number;
    driftExchanges: number;
    illegalTransitions: number;
    unknownActions: number;
  };
  featureRounds: { freeSpins: number; bonus: number; fist: number; anomalies: number };
}
