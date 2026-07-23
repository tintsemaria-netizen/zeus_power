import { describe, it, expect } from "vitest";
import { isLegalTransition, decideAction, DEFAULT_POLICY } from "../src/index.js";

describe("legal transitions (from capture)", () => {
  const legal: [string | null, string, string[]][] = [
    ["init", "spins", ["spin", "buy_spin", "set_params"]],
    ["spin", "spins", ["freespin_init"]],
    ["freespin_init", "freespins", ["freespin"]],
    ["freespin", "freespins", ["bonus_init"]],
    ["bonus_init", "bonus", ["respin"]],
    ["respin", "bonus", ["mini_bonus_init"]],
    ["mini_bonus_init", "fist_bonus", ["mini_bonus_pick"]],
    ["mini_bonus_pick", "fist_bonus", ["mini_bonus_stop"]],
    ["mini_bonus_stop", "bonus", ["bonus_spins_stop"]],
    ["bonus_spins_stop", "spins", ["spin", "buy_spin", "set_params"]],
    ["bonus_freespins_stop", "freespins", ["freespin"]],
    ["freespin_stop", "spins", ["spin", "buy_spin", "set_params"]],
    ["bw_collect", "spins", ["spin", "buy_spin", "set_params"]],
    ["spin", "spins", ["bw_gamble", "bw_collect"]],
  ];
  for (const [from, to, acts] of legal) {
    it(`${from} -> ${to} [${acts.join(",")}] is legal`, () => {
      expect(isLegalTransition(from, to, acts)).toBe(true);
      expect(isLegalTransition(from, to, [...acts].reverse())).toBe(true); // set, not sequence
    });
  }

  it("flags an unobserved/illegal transition", () => {
    expect(isLegalTransition("spin", "fist_bonus", ["mini_bonus_pick"])).toBe(false);
    expect(isLegalTransition("respin", "spins", ["spin"])).toBe(false);
  });
});

describe("action policy (spec §6)", () => {
  it("sends spin with configured bet", () => {
    const d = decideAction(["spin", "buy_spin", "set_params"]);
    expect(d.kind).toBe("send");
    if (d.kind === "send") {
      expect(d.action).toBe("spin");
      expect(d.params).toEqual({ bet_per_line: DEFAULT_POLICY.betPerLine, lines: DEFAULT_POLICY.lines });
    }
  });

  it("prefers bw_collect over bw_gamble", () => {
    const d = decideAction(["bw_gamble", "bw_collect"]);
    expect(d.kind).toBe("send");
    if (d.kind === "send") expect(d.action).toBe("bw_collect");
  });

  it("sends a single forced continuation", () => {
    for (const a of ["freespin", "respin", "mini_bonus_pick", "bonus_spins_stop"]) {
      const d = decideAction([a]);
      expect(d.kind).toBe("send");
      if (d.kind === "send") expect(d.action).toBe(a);
    }
  });

  it("refuses to send an uncaptured action even if mandatory-looking", () => {
    // buy_spin/set_params never travel alone in the capture, but guard anyway.
    const d = decideAction(["set_params"]);
    expect(d.kind).toBe("stop");
  });

  it("stops on an unknown action", () => {
    const d = decideAction(["teleport"]);
    expect(d.kind).toBe("stop");
    if (d.kind === "stop") expect(d.reason).toMatch(/unknown/);
  });

  it("never gambles by default", () => {
    const d = decideAction(["bw_gamble"]); // gamble alone: not collectible, must stop
    expect(d.kind).toBe("stop");
  });
});
