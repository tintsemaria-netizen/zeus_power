/**
 * Schema-drift detection. Zod schemas use `.passthrough()` so unknown fields survive;
 * this module REPORTS them so the pipeline can raise an alert instead of silently
 * ignoring drift (spec §1.5, §19). It never mutates or drops data.
 */

/** Known keys per structure, taken from the capture. New keys => drift. */
export const KNOWN_KEYS = {
  context: [
    "current",
    "actions",
    "version",
    "last_action",
    "last_args",
    "last_win",
    "round_finished",
    "achievements",
    "available_buy_bonus",
    "spins",
    "freespins",
    "bonus",
    "fist_bonus",
  ],
  "context.spins": [
    "bet_per_line",
    "lines",
    "round_bet",
    "round_win",
    "total_win",
    "cash_koef",
    "bs",
    "bs_count",
    "reelset_number",
    "board",
    "client",
    "wild_drop",
    "winlines",
    "winscatters",
    "bg_stop",
    "bw_gamble",
  ],
  "context.freespins": [
    "bet_per_line",
    "lines",
    "round_bet",
    "round_win",
    "total_win",
    "cash_koef",
    "bs",
    "bs_count",
    "reelset_number",
    "board",
    "client",
    "wild_drop",
    "winlines",
    "winscatters",
    "rounds_granted",
    "rounds_left",
  ],
  "context.bonus": [
    "bet_per_line",
    "lines",
    "round_bet",
    "round_win",
    "total_win",
    "cash_koef",
    "bg_type",
    "bs",
    "bs_count",
    "new_bs",
    "keys",
    "threshold_num",
    "rounds_granted",
    "rounds_left",
    "from_freespin",
    "reelset_number",
    "board",
    "board_spins",
    "client",
    "winscatters",
    "fist_bg",
    "bs_from_fist",
  ],
  "context.fist_bonus": [
    "bet_per_line",
    "lines",
    "round_bet",
    "total_win",
    "bs_count",
    "fist_bg_type",
    "fist_bs_count",
    "fist_mult_win",
    "fist_round_win",
    "fist_rounds_left",
    "fist_bs",
    "fist_new_bs",
    "board",
    "client",
  ],
  user: ["balance", "balance_version", "currency", "huid", "is_test", "show_balance"],
  response: [
    "command",
    "status",
    "request_id",
    "session_id",
    "user",
    "modes",
    "context",
    "settings",
    "origin_data",
  ],
} as const;

export interface DriftFinding {
  path: string;
  unknownKeys: string[];
}

function unknownKeysAt(path: keyof typeof KNOWN_KEYS, obj: unknown): string[] {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return [];
  const known = new Set<string>(KNOWN_KEYS[path]);
  return Object.keys(obj as Record<string, unknown>).filter((k) => !known.has(k));
}

/** Walk a parsed response and collect any keys not present in the capture-derived key sets. */
export function detectDrift(response: unknown): DriftFinding[] {
  const findings: DriftFinding[] = [];
  if (response === null || typeof response !== "object") return findings;
  const r = response as Record<string, unknown>;

  const push = (path: keyof typeof KNOWN_KEYS, obj: unknown) => {
    const unknown = unknownKeysAt(path, obj);
    if (unknown.length) findings.push({ path, unknownKeys: unknown });
  };

  push("response", r);
  push("user", r.user);
  const ctx = r.context as Record<string, unknown> | undefined;
  if (ctx) {
    push("context", ctx);
    push("context.spins", ctx.spins);
    push("context.freespins", ctx.freespins);
    push("context.bonus", ctx.bonus);
    push("context.fist_bonus", ctx.fist_bonus);
  }
  return findings;
}
