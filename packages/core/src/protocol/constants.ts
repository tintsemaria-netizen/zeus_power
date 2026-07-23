/**
 * Protocol constants for the Zeus Power demo game endpoint.
 *
 * All values here are DERIVED FROM THE SUPPLIED PACKET CAPTURE (input/capture.json,
 * 870 zeus_power records). Nothing is invented. Where the capture never demonstrated
 * a shape (buy_spin / set_params / bw_gamble request bodies) it is explicitly marked
 * unknown and MUST NOT be sent — see docs/known-unknowns.md.
 */

/** The single authorized game endpoint path fragment used to filter the capture. */
export const ENDPOINT_MARKER = "/gs/zeus_power/";

/** Top-level `gsc` query commands observed in the capture. */
export const GSC_COMMANDS = ["login", "start", "sync", "play"] as const;
export type GscCommand = (typeof GSC_COMMANDS)[number];

/** context.current states observed in the capture. Note the exact `fist_bonus` spelling. */
export const STATES = ["spins", "freespins", "bonus", "fist_bonus"] as const;
export type GameState = (typeof STATES)[number];

/**
 * All action names advertised in context.actions across the capture.
 * `captured: false` means the action was advertised but no request body was ever seen,
 * so we must not synthesize one.
 */
export const ACTIONS = {
  spin: { captured: true, hasParams: true },
  buy_spin: { captured: false, hasParams: true },
  set_params: { captured: false, hasParams: true },
  freespin_init: { captured: true, hasParams: false },
  freespin: { captured: true, hasParams: false },
  freespin_stop: { captured: true, hasParams: false },
  bonus_init: { captured: true, hasParams: false },
  respin: { captured: true, hasParams: false },
  bonus_spins_stop: { captured: true, hasParams: false },
  bonus_freespins_stop: { captured: true, hasParams: false },
  mini_bonus_init: { captured: true, hasParams: false },
  mini_bonus_pick: { captured: true, hasParams: false },
  mini_bonus_stop: { captured: true, hasParams: false },
  bw_gamble: { captured: false, hasParams: false },
  bw_collect: { captured: true, hasParams: false },
} as const;

export type ActionName = keyof typeof ACTIONS;
export const ALL_ACTION_NAMES = Object.keys(ACTIONS) as ActionName[];

/** Actions advertised but never captured — sending these is forbidden until schema-approved. */
export const UNCAPTURED_ACTIONS: ActionName[] = (
  Object.entries(ACTIONS) as [ActionName, { captured: boolean }][]
)
  .filter(([, v]) => !v.captured)
  .map(([k]) => k);

/**
 * Jackpot multiplier (x total bet) -> tier name, from settings.jackpots in the start response.
 */
export const JACKPOT_TIERS: Record<string, string> = {
  "10": "mini",
  "20": "minor",
  "40": "midi",
  "80": "major",
  "1000": "grand",
  "10000": "royal",
};

/** Symbol id semantics from settings (symbols_line / symbols_wild / symbols_scat). */
export const SYMBOL_ROLES = {
  line: [1, 2, 3, 4, 5, 6, 7, 8],
  wild: [9],
  scatter: [10],
  bonus: [11],
  hidden: [12],
} as const;

/** Bonus symbol type names used in analytics (regular values + jackpot tiers + fist). */
export const BONUS_SYMBOL_TYPES = [
  "regular",
  "mini",
  "minor",
  "midi",
  "major",
  "grand",
  "royal",
  "fist",
] as const;

/** Key thresholds that unlock rows 5..8 of the 5x8 bonus board. */
export const KEY_THRESHOLDS = [10, 15, 20, 25] as const;
