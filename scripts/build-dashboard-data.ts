/**
 * scripts/build-dashboard-data.ts
 *
 * Produces the self-contained analytics JSON the static dashboard renders. Runs the
 * import-only analyzer over the capture (no network) and emits aggregates: economics,
 * frequencies with Wilson CIs, RTP convergence, bankroll curve, win-multiplier histogram,
 * advertised-action-set distribution, state transitions, and protocol health.
 *
 * Usage: tsx scripts/build-dashboard-data.ts [inputPath] [--out file]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import {
  filterCapture,
  normalizeExchange,
  correlateRounds,
  summarizeRounds,
  wilson,
  toMajorUnits,
  type CaptureRecord,
  type NormalizedExchange,
} from "../packages/core/src/index.js";

function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const inputPath = resolve(
  process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "input/capture.json",
);
const outPath = resolve(flag("--out", "packages/dashboard/public/dashboard-data.json"));

const raw = JSON.parse(readFileSync(inputPath, "utf8")) as CaptureRecord[];
const { zeus, excludedCount } = filterCapture(raw);
const normalized = zeus.map(normalizeExchange);
const ordered = [...normalized].sort((a, b) =>
  (a.completedAt ?? "") === (b.completedAt ?? "")
    ? a.exchangeId.localeCompare(b.exchangeId)
    : (a.completedAt ?? "").localeCompare(b.completedAt ?? ""),
);
const play = ordered.filter((n) => n.command === "play");
const rounds = correlateRounds(play);
const stats = summarizeRounds(rounds);

const paid = rounds.filter((r) => (r.wagerMinor ?? 0) > 0);

// RTP convergence + bankroll (net) over paid spins, downsampled to <= 600 points.
const conv: { i: number; rtp: number; net: number }[] = [];
let cw = 0;
let cp = 0;
paid.forEach((r, idx) => {
  cw += r.wagerMinor ?? 0;
  cp += r.finalWinMinor ?? 0;
  conv.push({ i: idx + 1, rtp: cw > 0 ? cp / cw : 0, net: toMajorUnits(cp - cw) });
});
const step = Math.max(1, Math.floor(conv.length / 600));
const convergence = conv.filter((_, i) => i % step === 0 || i === conv.length - 1);

// Win-multiplier histogram (finalWin / bet), log-ish buckets.
const buckets = [0, 0.0001, 0.5, 1, 2, 5, 10, 20, 50, 100, Infinity];
const labels = ["0", "0-0.5x", "0.5-1x", "1-2x", "2-5x", "5-10x", "10-20x", "20-50x", "50-100x", "100x+"];
const hist = new Array(labels.length).fill(0);
for (const r of paid) {
  const x = (r.wagerMinor ?? 0) > 0 ? (r.finalWinMinor ?? 0) / (r.wagerMinor ?? 1) : 0;
  for (let b = 0; b < labels.length; b++) {
    if (x >= buckets[b]! && x < buckets[b + 1]!) {
      hist[b]++;
      break;
    }
  }
}

// Advertised action-set distribution.
const actionSets: Record<string, number> = {};
for (const n of ordered) {
  if (n.advertisedActions.length) {
    const k = n.advertisedActions.join(", ");
    actionSets[k] = (actionSets[k] ?? 0) + 1;
  }
}

// State transitions (last_action -> current).
const transitions: Record<string, number> = {};
for (const n of ordered) {
  if (n.state && n.lastAction) {
    const k = `${n.lastAction} → ${n.state}`;
    transitions[k] = (transitions[k] ?? 0) + 1;
  }
}

// Protocol health: latency percentiles + status counts.
const lat = ordered.map((n) => n.latencyMs).filter((x): x is number => x != null).sort((a, b) => a - b);
const pct = (p: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor((p / 100) * lat.length))]! : 0);
const httpStatus: Record<string, number> = {};
const appStatus: Record<string, number> = {};
for (const n of ordered) {
  if (n.httpStatus != null) httpStatus[String(n.httpStatus)] = (httpStatus[String(n.httpStatus)] ?? 0) + 1;
  if (n.appStatusCode) appStatus[n.appStatusCode] = (appStatus[n.appStatusCode] ?? 0) + 1;
}

const w = (k: number, n: number) => {
  const iv = wilson(k, n);
  return { p: iv.p, low: iv.low, high: iv.high, k, n };
};

const data = {
  meta: {
    source: inputPath.split("/").pop(),
    totalRecords: raw.length,
    zeusRecords: zeus.length,
    excludedRecords: excludedCount,
    playExchanges: play.length,
    derivedRounds: rounds.length,
    generatedNote: "Empirical statistics from the captured sample — NOT theoretical RNG values.",
  },
  economics: {
    paidSpins: stats.paidSpins,
    completedRounds: stats.completedRounds,
    wager: toMajorUnits(stats.wagerMinor),
    payout: toMajorUnits(stats.payoutMinor),
    ggr: toMajorUnits(stats.ggrMinor),
    rtp: stats.rtp,
    avgWinPerSpin: toMajorUnits(stats.avgWinPerSpinMinor),
    maxWinXBet: stats.maxWinXBet,
    volatilityXBet: stats.volatilityXBet,
  },
  frequencies: {
    hit: w(stats.hitFrequency.k, stats.hitFrequency.n),
    freeSpin: w(stats.freeSpinTriggerFreq.k, stats.freeSpinTriggerFreq.n),
    bonus: w(stats.bonusTriggerFreq.k, stats.bonusTriggerFreq.n),
    fist: w(stats.fistFeatureFreq.k, stats.fistFeatureFreq.n),
  },
  convergence,
  histogram: { labels, counts: hist },
  actionSets,
  transitions,
  health: {
    latencyMs: { p50: pct(50), p95: pct(95), p99: pct(99), max: lat.length ? lat[lat.length - 1] : 0 },
    httpStatus,
    appStatus,
    parseErrors: ordered.filter((n) => n.parseErrors.length).length,
    driftExchanges: ordered.filter((n) => n.drift.length).length,
    illegalTransitions: ordered.filter((n) => n.illegalTransition).length,
    unknownActions: ordered.filter((n) => n.unknownAction).length,
  },
  featureRounds: {
    freeSpins: rounds.filter((r) => r.hadFreeSpins).length,
    bonus: rounds.filter((r) => r.hadBonus).length,
    fist: rounds.filter((r) => r.hadFist).length,
    anomalies: rounds.filter((r) => r.anomalies.length).length,
  },
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(data, null, 2));
console.log(`[dashboard-data] wrote ${outPath} (${stats.paidSpins} spins, rtp=${stats.rtp.toFixed(4)})`);
