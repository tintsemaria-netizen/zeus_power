/**
 * Reproducible statistics (spec §10). Point estimates + sample sizes; rates carry a
 * Wilson 95% confidence interval. These are EMPIRICAL observed statistics from the
 * sample — NOT the theoretical RNG probabilities.
 */
import type { DerivedRound } from "../correlation/round-correlator.js";

export interface WilsonInterval {
  p: number;
  low: number;
  high: number;
  n: number;
  k: number;
}

/** Wilson score interval for a binomial proportion (default 95%, z = 1.959963985). */
export function wilson(k: number, n: number, z = 1.959963985): WilsonInterval {
  if (n === 0) return { p: 0, low: 0, high: 0, n, k };
  const phat = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (phat + z2 / (2 * n)) / denom;
  const margin = (z * Math.sqrt((phat * (1 - phat)) / n + z2 / (4 * n * n))) / denom;
  return { p: phat, low: Math.max(0, center - margin), high: Math.min(1, center + margin), n, k };
}

export interface RtpSummary {
  paidSpins: number;
  completedRounds: number;
  wagerMinor: number;
  payoutMinor: number;
  ggrMinor: number;
  /** empirical RTP = payout / wager */
  rtp: number;
  avgWinPerSpinMinor: number;
  hitFrequency: WilsonInterval; // rounds with final return > 0
  freeSpinTriggerFreq: WilsonInterval;
  bonusTriggerFreq: WilsonInterval;
  fistFeatureFreq: WilsonInterval;
  maxWinMinor: number;
  maxWinXBet: number;
  /** sample standard deviation of return per paid round (in xBet units) */
  volatilityXBet: number;
}

/** Compute the core-economics summary over derived rounds (each round = one paid spin). */
export function summarizeRounds(rounds: DerivedRound[]): RtpSummary {
  const paid = rounds.filter((r) => r.wagerMinor != null && r.wagerMinor > 0);
  const n = paid.length;
  let wager = 0;
  let payout = 0;
  let hits = 0;
  let free = 0;
  let bonus = 0;
  let fist = 0;
  let maxWin = 0;
  let maxWinX = 0;
  const returnsX: number[] = [];

  for (const r of paid) {
    const bet = r.wagerMinor ?? 0;
    const win = r.finalWinMinor ?? 0;
    wager += bet;
    payout += win;
    if (win > 0) hits++;
    if (r.hadFreeSpins) free++;
    if (r.hadBonus) bonus++;
    if (r.hadFist) fist++;
    if (win > maxWin) {
      maxWin = win;
      maxWinX = bet > 0 ? win / bet : 0;
    }
    returnsX.push(bet > 0 ? win / bet : 0);
  }

  const meanX = returnsX.length ? returnsX.reduce((a, b) => a + b, 0) / returnsX.length : 0;
  const variance =
    returnsX.length > 1
      ? returnsX.reduce((a, b) => a + (b - meanX) ** 2, 0) / (returnsX.length - 1)
      : 0;

  return {
    paidSpins: n,
    completedRounds: rounds.filter((r) => r.closed).length,
    wagerMinor: wager,
    payoutMinor: payout,
    ggrMinor: wager - payout,
    rtp: wager > 0 ? payout / wager : 0,
    avgWinPerSpinMinor: n > 0 ? payout / n : 0,
    hitFrequency: wilson(hits, n),
    freeSpinTriggerFreq: wilson(free, n),
    bonusTriggerFreq: wilson(bonus, n),
    fistFeatureFreq: wilson(fist, n),
    maxWinMinor: maxWin,
    maxWinXBet: maxWinX,
    volatilityXBet: Math.sqrt(variance),
  };
}
