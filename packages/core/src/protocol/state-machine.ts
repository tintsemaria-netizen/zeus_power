/**
 * Server-driven state machine (spec §3, §6).
 *
 * The server response is AUTHORITATIVE: the bot never decides the next protocol action
 * from local assumptions. This module (a) validates that transitions we observe are legal
 * against the capture-derived graph, and (b) selects the next action to send using the
 * default policy — but ONLY from the actions the server advertised in `context.actions`.
 */
import { ACTIONS, UNCAPTURED_ACTIONS, type ActionName, type GameState } from "./constants.js";

/**
 * Legal transition graph, derived verbatim from the capture
 * (last_action -> current / advertised actions). Used to VALIDATE observed transitions
 * and flag illegal ones; it is not used to drive actions (the server does that).
 */
export interface Transition {
  from: ActionName | "start" | "init";
  toState: GameState;
  advertised: ActionName[];
}

export const OBSERVED_TRANSITIONS: Transition[] = [
  { from: "init", toState: "spins", advertised: ["spin", "buy_spin", "set_params"] },
  { from: "start", toState: "spins", advertised: ["spin", "buy_spin", "set_params"] },
  { from: "spin", toState: "spins", advertised: ["spin", "buy_spin", "set_params"] },
  { from: "spin", toState: "spins", advertised: ["freespin_init"] },
  { from: "spin", toState: "spins", advertised: ["bonus_init"] },
  { from: "spin", toState: "spins", advertised: ["bw_gamble", "bw_collect"] },
  { from: "bw_collect", toState: "spins", advertised: ["spin", "buy_spin", "set_params"] },
  { from: "freespin_init", toState: "freespins", advertised: ["freespin"] },
  { from: "freespin", toState: "freespins", advertised: ["freespin"] },
  { from: "freespin", toState: "freespins", advertised: ["bonus_init"] },
  { from: "freespin", toState: "freespins", advertised: ["freespin_stop"] },
  { from: "freespin_stop", toState: "spins", advertised: ["spin", "buy_spin", "set_params"] },
  { from: "bonus_init", toState: "bonus", advertised: ["respin"] },
  { from: "respin", toState: "bonus", advertised: ["respin"] },
  { from: "respin", toState: "bonus", advertised: ["mini_bonus_init"] },
  { from: "respin", toState: "bonus", advertised: ["bonus_spins_stop"] },
  { from: "respin", toState: "bonus", advertised: ["bonus_freespins_stop"] },
  { from: "mini_bonus_init", toState: "fist_bonus", advertised: ["mini_bonus_pick"] },
  { from: "mini_bonus_pick", toState: "fist_bonus", advertised: ["mini_bonus_pick"] },
  { from: "mini_bonus_pick", toState: "fist_bonus", advertised: ["mini_bonus_stop"] },
  { from: "mini_bonus_stop", toState: "bonus", advertised: ["bonus_spins_stop"] },
  { from: "bonus_spins_stop", toState: "spins", advertised: ["spin", "buy_spin", "set_params"] },
  { from: "bonus_freespins_stop", toState: "freespins", advertised: ["freespin"] },
];

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

/** True if (lastAction -> current/actions) matches an observed legal transition. */
export function isLegalTransition(
  lastAction: string | null | undefined,
  toState: string,
  advertised: string[],
): boolean {
  const from = lastAction ?? "init";
  return OBSERVED_TRANSITIONS.some(
    (t) => t.from === from && t.toState === toState && sameSet(t.advertised, advertised),
  );
}

export interface PolicyConfig {
  betPerLine: number;
  lines: number;
  /** Never true unless the exact request contract is captured & approved. Always false here. */
  enableExperimentalGamble: boolean;
}

export const DEFAULT_POLICY: PolicyConfig = {
  betPerLine: 5,
  lines: 20,
  enableExperimentalGamble: false,
};

export type ActionDecision =
  | { kind: "send"; action: ActionName; params?: Record<string, unknown>; reason: string }
  | { kind: "stop"; reason: string; advertised: string[] };

/**
 * Choose the next action to send, given the actions the SERVER advertised.
 * Returns a `stop` decision (pause the worker + raise alert) for anything ambiguous,
 * unknown, or uncaptured — never invents a request body.
 */
export function decideAction(advertised: string[], policy: PolicyConfig = DEFAULT_POLICY): ActionDecision {
  const set = new Set(advertised);

  // Unknown action advertised => stop safely (spec §6).
  const unknown = advertised.filter((a) => !(a in ACTIONS));
  if (unknown.length) {
    return { kind: "stop", reason: `unknown action(s) advertised: ${unknown.join(", ")}`, advertised };
  }

  // Big-win choice: prefer bw_collect (spec §3, §6, §19). Never gamble by default.
  if (set.has("bw_collect")) {
    return { kind: "send", action: "bw_collect", reason: "big-win: collect (gamble disabled)" };
  }

  // Base spin available.
  if (set.has("spin")) {
    return {
      kind: "send",
      action: "spin",
      params: { bet_per_line: policy.betPerLine, lines: policy.lines },
      reason: "base spin with configured bet",
    };
  }

  // Exactly one mandatory continuation action -> send it (spec §6), unless uncaptured.
  const mandatory: ActionName[] = [
    "freespin_init",
    "freespin",
    "bonus_init",
    "respin",
    "mini_bonus_init",
    "mini_bonus_pick",
    "mini_bonus_stop",
    "bonus_spins_stop",
    "bonus_freespins_stop",
    "freespin_stop",
  ];
  const forced = advertised.filter((a) => mandatory.includes(a as ActionName));
  if (forced.length === 1 && advertised.length === 1) {
    const action = forced[0] as ActionName;
    if (UNCAPTURED_ACTIONS.includes(action)) {
      return { kind: "stop", reason: `mandatory action ${action} has no captured request body`, advertised };
    }
    return { kind: "send", action, reason: `forced continuation: ${action}` };
  }

  return { kind: "stop", reason: `no supported single action to send`, advertised };
}
