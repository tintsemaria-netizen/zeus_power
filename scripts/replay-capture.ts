/**
 * scripts/replay-capture.ts (spec §17, mode C — replay validator).
 *
 * Replays the captured responses through the parser + state machine + round correlator
 * WITHOUT contacting the server, and produces a DETERMINISTIC summary. This is the
 * acceptance test for "the supplied capture imports without crashing" (spec §19).
 *
 * Usage: tsx scripts/replay-capture.ts [inputPath] [--out dir]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  filterCapture,
  normalizeExchange,
  correlateRounds,
  summarizeRounds,
  toMajorUnits,
  type CaptureRecord,
} from "../packages/core/src/index.js";

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const inputPath = resolve(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "input/capture.json");
const outDir = resolve(arg("--out", "out"));

const raw = JSON.parse(readFileSync(inputPath, "utf8")) as CaptureRecord[];
const { zeus } = filterCapture(raw);
const normalized = zeus.map(normalizeExchange);

// Deterministic ordering by capture completion time, then exchange id, so replay is stable.
const ordered = [...normalized].sort((a, b) => {
  const ta = a.completedAt ?? "";
  const tb = b.completedAt ?? "";
  return ta === tb ? a.exchangeId.localeCompare(b.exchangeId) : ta.localeCompare(tb);
});

const play = ordered.filter((n) => n.command === "play");
const rounds = correlateRounds(play);
const stats = summarizeRounds(rounds);

// Distribution of advertised action sets (spec §10 protocol health).
const actionSets: Record<string, number> = {};
for (const n of ordered) {
  if (n.advertisedActions.length) {
    const key = n.advertisedActions.join(",");
    actionSets[key] = (actionSets[key] ?? 0) + 1;
  }
}

const summary = {
  algorithm: "replay-v1",
  totalRecords: raw.length,
  zeusRecords: zeus.length,
  playExchanges: play.length,
  derivedRounds: rounds.length,
  roundsWithFreeSpins: rounds.filter((r) => r.hadFreeSpins).length,
  roundsWithBonus: rounds.filter((r) => r.hadBonus).length,
  roundsWithFist: rounds.filter((r) => r.hadFist).length,
  roundsWithAnomalies: rounds.filter((r) => r.anomalies.length).length,
  economics: {
    paidSpins: stats.paidSpins,
    completedRounds: stats.completedRounds,
    wager: toMajorUnits(stats.wagerMinor),
    payout: toMajorUnits(stats.payoutMinor),
    ggr: toMajorUnits(stats.ggrMinor),
    rtp: Number(stats.rtp.toFixed(6)),
    avgWinPerSpin: Number(toMajorUnits(stats.avgWinPerSpinMinor).toFixed(4)),
    maxWinXBet: Number(stats.maxWinXBet.toFixed(2)),
    volatilityXBet: Number(stats.volatilityXBet.toFixed(4)),
  },
  frequencies: {
    hitFrequency: fmt(stats.hitFrequency),
    freeSpinTrigger: fmt(stats.freeSpinTriggerFreq),
    bonusTrigger: fmt(stats.bonusTriggerFreq),
    fistFeature: fmt(stats.fistFeatureFreq),
  },
  health: {
    parseErrors: ordered.filter((n) => n.parseErrors.length).length,
    driftExchanges: ordered.filter((n) => n.drift.length).length,
    illegalTransitions: ordered.filter((n) => n.illegalTransition).length,
    unknownActions: ordered.filter((n) => n.unknownAction).length,
    appStatusNonOk: ordered.filter((n) => n.appStatusCode != null && n.appStatusCode !== "OK").length,
  },
  advertisedActionSets: actionSets,
};

function fmt(w: { p: number; low: number; high: number; n: number; k: number }) {
  return { p: Number(w.p.toFixed(4)), ci95: [Number(w.low.toFixed(4)), Number(w.high.toFixed(4))], k: w.k, n: w.n };
}

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "replay-summary.json"), JSON.stringify(summary, null, 2));

console.log(JSON.stringify(summary, null, 2));
console.log(`\n[replay] wrote ${outDir}/replay-summary.json`);
