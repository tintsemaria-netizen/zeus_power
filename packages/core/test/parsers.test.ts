import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GameResponse,
  LoginRequest,
  PlayRequest,
  detectDrift,
  normalizeExchange,
  type CaptureRecord,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "fixtures");
const load = (name: string): CaptureRecord =>
  JSON.parse(readFileSync(resolve(fixturesDir, name), "utf8"));

describe("fixtures", () => {
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));

  it("has a fixture for every observed action and state", () => {
    expect(files).toContain("action_spin.json");
    expect(files).toContain("action_bw_collect.json");
    expect(files).toContain("state_fist_bonus.json"); // exact spelling preserved
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  it("every fixture normalizes without parse errors or drift", () => {
    for (const f of files) {
      const n = normalizeExchange(load(f));
      expect(n.parseErrors, `${f}: ${n.parseErrors.join("|")}`).toEqual([]);
      expect(n.drift, `${f} drift`).toEqual([]);
      expect(n.raw).toBeDefined(); // raw always preserved
    }
  });
});

describe("schema passthrough", () => {
  it("preserves the string type of mobile:'0'", () => {
    const rec = load("action_spin.json");
    const parsed = PlayRequest.parse(rec.requestBody);
    expect(parsed.mobile).toBe("0");
    expect(typeof parsed.mobile).toBe("string");
  });

  it("does not discard unknown fields (passthrough)", () => {
    const withExtra = { ...(load("state_spins.json").responseBody as object), __novel_field__: 42 };
    const parsed = GameResponse.parse(withExtra);
    expect((parsed as Record<string, unknown>).__novel_field__).toBe(42);
  });

  it("detectDrift flags a novel key instead of dropping it", () => {
    const body = load("state_spins.json").responseBody as Record<string, unknown>;
    const mutated = { ...body, context: { ...(body.context as object), surprise: 1 } };
    const drift = detectDrift(mutated);
    expect(drift.some((d) => d.path === "context" && d.unknownKeys.includes("surprise"))).toBe(true);
  });

  it("redacted login token stays redacted (no secret in fixture)", () => {
    const rec = load("cmd_login.json");
    const parsed = LoginRequest.parse(rec.requestBody);
    expect(parsed.token).toBe("REDACTED");
  });
});
