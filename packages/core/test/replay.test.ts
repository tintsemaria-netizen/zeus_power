import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  filterCapture,
  normalizeExchange,
  correlateRounds,
  summarizeRounds,
  type CaptureRecord,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const capturePath = resolve(here, "../../../input/capture.json");

describe("full-capture replay (spec §19 acceptance)", () => {
  if (!existsSync(capturePath)) {
    it.skip("capture file present", () => {});
    return;
  }
  const raw = JSON.parse(readFileSync(capturePath, "utf8")) as CaptureRecord[];
  const { zeus } = filterCapture(raw);
  const normalized = zeus.map(normalizeExchange);
  const ordered = [...normalized].sort((a, b) =>
    (a.completedAt ?? "") === (b.completedAt ?? "")
      ? a.exchangeId.localeCompare(b.exchangeId)
      : (a.completedAt ?? "").localeCompare(b.completedAt ?? ""),
  );
  const play = ordered.filter((n) => n.command === "play");
  const rounds = correlateRounds(play);

  it("filters exactly the zeus_power endpoint", () => {
    expect(raw.length).toBe(963);
    expect(zeus.length).toBe(870);
  });

  it("imports without a single parse crash", () => {
    expect(normalized.length).toBe(870);
    expect(normalized.every((n) => n.raw !== undefined)).toBe(true);
  });

  it("has no parse errors, drift, illegal transitions, or unknown actions", () => {
    expect(normalized.filter((n) => n.parseErrors.length).length).toBe(0);
    expect(normalized.filter((n) => n.drift.length).length).toBe(0);
    expect(normalized.filter((n) => n.illegalTransition).length).toBe(0);
    expect(normalized.filter((n) => n.unknownAction).length).toBe(0);
  });

  it("derives 779 rounds and collapses feature chains", () => {
    expect(play.length).toBe(854);
    expect(rounds.length).toBe(779);
    expect(rounds.filter((r) => r.hadFreeSpins).length).toBe(1);
    expect(rounds.filter((r) => r.hadBonus).length).toBe(4);
    expect(rounds.filter((r) => r.hadFist).length).toBe(2);
  });

  it("is deterministic — same input yields same RTP", () => {
    const a = summarizeRounds(rounds);
    const b = summarizeRounds(correlateRounds(play));
    expect(a.rtp).toBe(b.rtp);
    expect(a.paidSpins).toBe(779);
    expect(a.wagerMinor).toBeGreaterThan(0);
  });

  it("does not double-count: final win attributed once per paid round", () => {
    const stats = summarizeRounds(rounds);
    // payout must equal the sum of per-round finalWin (one attribution per round)
    const manual = rounds
      .filter((r) => (r.wagerMinor ?? 0) > 0)
      .reduce((s, r) => s + (r.finalWinMinor ?? 0), 0);
    expect(stats.payoutMinor).toBe(manual);
  });
});
