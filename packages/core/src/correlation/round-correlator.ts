/**
 * Derived round & feature-chain correlation (spec §8). The packets have no explicit
 * round id, so we derive one:
 *   - a base round opens on a legal `spin` action;
 *   - the same feature-chain id persists while round_finished === false;
 *   - free spins / bonus / fist mini-feature / stop actions / big-win collect all attach
 *     to the originating base spin;
 *   - the round closes when round_finished === true and normal spins resume.
 * The final feature-chain payout is attributed to the originating paid spin (no double
 * counting); component wins remain available on each exchange for breakdowns.
 */
import type { NormalizedExchange } from "../normalize/normalizer.js";

export const CORRELATION_ALGORITHM_VERSION = 1;

export interface DerivedRound {
  roundId: string;
  featureChainId: string;
  algorithmVersion: number;
  sessionId: string | null;
  originExchangeId: string;
  /** wager for the round = round_bet of the opening spin, minor units */
  wagerMinor: number | null;
  /** final payout attributed to this paid spin (closing exchange total_win), minor units */
  finalWinMinor: number | null;
  statesVisited: string[];
  actions: string[];
  exchangeIds: string[];
  hadFreeSpins: boolean;
  hadBonus: boolean;
  hadFist: boolean;
  closed: boolean;
  startedAt: string | null;
  anomalies: string[];
}

function newRound(ex: NormalizedExchange, seq: number): DerivedRound {
  const id = `${ex.sessionId ?? "nosession"}:r${seq}:${ex.exchangeId}`;
  return {
    roundId: id,
    featureChainId: id,
    algorithmVersion: CORRELATION_ALGORITHM_VERSION,
    sessionId: ex.sessionId,
    originExchangeId: ex.exchangeId,
    wagerMinor: ex.roundBet,
    finalWinMinor: ex.totalWin ?? ex.roundWin,
    statesVisited: ex.state ? [ex.state] : [],
    actions: ex.actionName ? [ex.actionName] : [],
    exchangeIds: [ex.exchangeId],
    hadFreeSpins: ex.state === "freespins",
    hadBonus: ex.state === "bonus",
    hadFist: ex.state === "fist_bonus",
    closed: ex.roundFinished === true,
    startedAt: ex.startedAt,
    anomalies: [],
  };
}

/**
 * Correlate a time-ordered list of normalized PLAY exchanges into derived rounds.
 * Non-play exchanges (login/start/sync) should be filtered out before calling.
 */
export function correlateRounds(playExchanges: NormalizedExchange[]): DerivedRound[] {
  const rounds: DerivedRound[] = [];
  let current: DerivedRound | null = null;
  let seq = 0;

  for (const ex of playExchanges) {
    const isSpin = ex.actionName === "spin";

    if (isSpin && (current === null || current.closed)) {
      // Normal case: a fresh paid spin starts a new round.
      current = newRound(ex, seq++);
      rounds.push(current);
      continue;
    }

    if (isSpin && current && !current.closed) {
      // Anomaly: a spin arrived while a feature round was still open (spec §8 detection).
      current.anomalies.push(`spin ${ex.exchangeId} started while round ${current.roundId} unfinished`);
      current.closed = true;
      current = newRound(ex, seq++);
      rounds.push(current);
      continue;
    }

    // Continuation exchange (freespin/respin/mini_bonus/*_stop/bw_collect/...).
    if (current === null) {
      // Feature action with no open round (out-of-order / mid-capture start): open a salvage round.
      current = newRound(ex, seq++);
      current.anomalies.push(`continuation ${ex.actionName} with no open round`);
      rounds.push(current);
      continue;
    }

    current.exchangeIds.push(ex.exchangeId);
    if (ex.actionName) current.actions.push(ex.actionName);
    if (ex.state && !current.statesVisited.includes(ex.state)) current.statesVisited.push(ex.state);
    current.hadFreeSpins ||= ex.state === "freespins";
    current.hadBonus ||= ex.state === "bonus";
    current.hadFist ||= ex.state === "fist_bonus";
    // Attribute the running/closing payout to the originating paid spin.
    if (ex.totalWin != null) current.finalWinMinor = ex.totalWin;
    else if (ex.roundWin != null) current.finalWinMinor = ex.roundWin;
    if (ex.roundFinished === true) current.closed = true;
  }

  return rounds;
}
