/**
 * scripts/import-capture.ts (spec §17, mode A — import-only analyzer).
 *
 * Reads a browser network-export JSON, filters to the authorized Zeus Power endpoint,
 * normalizes every exchange (preserving raw payloads), and writes a report to disk.
 * Sends NO network requests.
 *
 * Usage: tsx scripts/import-capture.ts [inputPath] [--out dir]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  filterCapture,
  normalizeExchange,
  type CaptureRecord,
  type NormalizedExchange,
} from "../packages/core/src/index.js";

function arg(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const inputPath = resolve(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "input/capture.json");
const outDir = resolve(arg("--out", "out"));

console.log(`[import] reading ${inputPath}`);
const raw = JSON.parse(readFileSync(inputPath, "utf8")) as CaptureRecord[];
console.log(`[import] ${raw.length} total records`);

const { zeus, excludedCount, excludedHosts } = filterCapture(raw);
console.log(`[import] ${zeus.length} zeus_power records, ${excludedCount} excluded`);

const normalized: NormalizedExchange[] = zeus.map(normalizeExchange);

const parseErrors = normalized.filter((n) => n.parseErrors.length);
const drift = normalized.filter((n) => n.drift.length);
const illegal = normalized.filter((n) => n.illegalTransition);
const unknown = normalized.filter((n) => n.unknownAction);

mkdirSync(outDir, { recursive: true });
// Strip the bulky raw payload from the on-disk index; a full raw store belongs in ClickHouse later.
const index = normalized.map(({ raw: _raw, ...rest }) => rest);
writeFileSync(resolve(outDir, "normalized.json"), JSON.stringify(index, null, 2));

const report = {
  input: inputPath,
  totalRecords: raw.length,
  zeusRecords: zeus.length,
  excludedCount,
  excludedHosts,
  parseErrors: parseErrors.length,
  driftExchanges: drift.length,
  driftFields: [...new Set(drift.flatMap((d) => d.drift.flatMap((f) => f.unknownKeys.map((k) => `${f.path}.${k}`))))].sort(),
  illegalTransitions: illegal.length,
  unknownActions: unknown.length,
};
writeFileSync(resolve(outDir, "import-report.json"), JSON.stringify(report, null, 2));

console.log(`[import] parseErrors=${report.parseErrors} drift=${report.driftExchanges} illegal=${report.illegalTransitions} unknownActions=${report.unknownActions}`);
console.log(`[import] drift fields: ${report.driftFields.join(", ") || "(none)"}`);
console.log(`[import] wrote ${outDir}/normalized.json and import-report.json`);
