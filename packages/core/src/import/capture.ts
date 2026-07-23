/**
 * Capture import + filtering (spec §1, §5A). Reads a browser network-export JSON array
 * and keeps ONLY the authorized Zeus Power game endpoint, excluding ChatGPT, analytics,
 * Datadog, Google, Yandex, Stripe and other unrelated traffic. Raw records are preserved.
 */
import { ENDPOINT_MARKER } from "../protocol/constants.js";

/** A raw record as exported by the capture tool. Extra fields are preserved. */
export interface CaptureRecord {
  id: string;
  method: string;
  url: string;
  pageUrl?: string;
  startedAt?: string;
  completedAt?: string;
  status?: number;
  statusText?: string;
  requestBody?: unknown;
  responseBody?: unknown;
  requestHeaders?: unknown;
  responseHeadersRaw?: unknown;
  [k: string]: unknown;
}

/** Parse the `gsc` top-level command from a request URL. */
export function parseGsc(url: string): string | null {
  const q = url.split("?")[1];
  if (!q) return null;
  for (const pair of q.split("&")) {
    const [k, v] = pair.split("=");
    if (k === "gsc") return decodeURIComponent(v ?? "");
  }
  return null;
}

/** True iff this record targets the authorized Zeus Power game endpoint. */
export function isZeusEndpoint(rec: CaptureRecord): boolean {
  return (
    rec.method === "POST" &&
    typeof rec.url === "string" &&
    rec.url.includes(ENDPOINT_MARKER) &&
    parseGsc(rec.url) !== null
  );
}

export interface FilterResult {
  zeus: CaptureRecord[];
  excludedCount: number;
  excludedHosts: Record<string, number>;
}

/** Filter a capture array to Zeus records, reporting what was excluded (for the audit log). */
export function filterCapture(records: CaptureRecord[]): FilterResult {
  const zeus: CaptureRecord[] = [];
  const excludedHosts: Record<string, number> = {};
  let excludedCount = 0;
  for (const rec of records) {
    if (isZeusEndpoint(rec)) {
      zeus.push(rec);
    } else {
      excludedCount++;
      let host = "unknown";
      try {
        host = new URL(rec.url).host;
      } catch {
        /* keep "unknown" */
      }
      excludedHosts[host] = (excludedHosts[host] ?? 0) + 1;
    }
  }
  return { zeus, excludedCount, excludedHosts };
}
