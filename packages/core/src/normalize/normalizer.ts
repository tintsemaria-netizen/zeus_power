/**
 * Normalizer (spec §9). Turns one raw capture exchange into a stable normalized event
 * while ALWAYS retaining the raw payload and surfacing (never hiding) parse failures,
 * schema drift, and illegal transitions.
 */
import { z } from "zod";
import type { CaptureRecord } from "../import/capture.js";
import { parseGsc } from "../import/capture.js";
import { GameResponse, AnyRequest } from "../protocol/schemas.js";
import { detectDrift, type DriftFinding } from "../protocol/drift.js";
import { isLegalTransition } from "../protocol/state-machine.js";
import { ALL_ACTION_NAMES } from "../protocol/constants.js";

export interface NormalizedExchange {
  exchangeId: string;
  gsc: string | null;
  command: string | null;
  requestId: string | null;
  sessionId: string | null;
  actionName: string | null;
  /** context.current after this response (null for sync). */
  state: string | null;
  advertisedActions: string[];
  lastAction: string | null;
  contextVersion: number | null;
  roundFinished: boolean | null;
  /** money in MINOR UNITS */
  roundBet: number | null;
  roundWin: number | null;
  totalWin: number | null;
  balance: number | null;
  balanceVersion: number | null;
  reelsetNumber: number | null;
  httpStatus: number | null;
  appStatusCode: string | null;
  startedAt: string | null;
  completedAt: string | null;
  latencyMs: number | null;
  /** issues that must be surfaced, not discarded */
  parseErrors: string[];
  drift: DriftFinding[];
  illegalTransition: boolean;
  unknownAction: boolean;
  /** raw payloads always preserved */
  raw: CaptureRecord;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function latency(started?: string | null, completed?: string | null): number | null {
  if (!started || !completed) return null;
  const a = Date.parse(started);
  const b = Date.parse(completed);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return b - a;
}

export function normalizeExchange(rec: CaptureRecord): NormalizedExchange {
  const parseErrors: string[] = [];
  const gsc = parseGsc(rec.url);

  // Request (best-effort; failures are recorded, not thrown).
  const reqParsed = AnyRequest.safeParse(rec.requestBody);
  if (!reqParsed.success && rec.requestBody != null) {
    parseErrors.push(`request: ${flatten(reqParsed.error)}`);
  }
  const reqBody = (rec.requestBody ?? {}) as Record<string, unknown>;
  const actionName =
    reqBody.command === "play" && reqBody.action && typeof reqBody.action === "object"
      ? str((reqBody.action as Record<string, unknown>).name)
      : null;

  // Response.
  const resParsed = GameResponse.safeParse(rec.responseBody);
  if (!resParsed.success && rec.responseBody != null) {
    parseErrors.push(`response: ${flatten(resParsed.error)}`);
  }
  const res = (rec.responseBody ?? {}) as Record<string, unknown>;
  const ctx = (res.context ?? undefined) as Record<string, unknown> | undefined;
  const user = (res.user ?? undefined) as Record<string, unknown> | undefined;

  const state = ctx ? str(ctx.current) : null;
  const advertisedActions = ctx && Array.isArray(ctx.actions) ? (ctx.actions as string[]) : [];
  const lastAction = ctx ? str(ctx.last_action) : null;
  const roundFinished = ctx && typeof ctx.round_finished === "boolean" ? ctx.round_finished : null;

  // Mode object for the current state carries the money fields.
  const modeObj =
    ctx && state && typeof ctx[state] === "object"
      ? (ctx[state] as Record<string, unknown>)
      : undefined;

  const drift = rec.responseBody != null ? detectDrift(rec.responseBody) : [];

  const unknownAction = advertisedActions.some((a) => !ALL_ACTION_NAMES.includes(a as never));
  const illegalTransition =
    ctx != null &&
    state != null &&
    advertisedActions.length > 0 &&
    !isLegalTransition(lastAction, state, advertisedActions);

  return {
    exchangeId: rec.id,
    gsc,
    command: str(res.command) ?? str(reqBody.command),
    requestId: str(res.request_id) ?? str(reqBody.request_id),
    sessionId: str(res.session_id) ?? str(reqBody.session_id),
    actionName,
    state,
    advertisedActions,
    lastAction,
    contextVersion: ctx ? num(ctx.version) : null,
    roundFinished,
    roundBet: modeObj ? num(modeObj.round_bet) : null,
    roundWin: modeObj ? num(modeObj.round_win) : null,
    totalWin: modeObj ? num(modeObj.total_win) : null,
    balance: user ? num(user.balance) : null,
    balanceVersion: user ? num(user.balance_version) : null,
    reelsetNumber: modeObj ? num(modeObj.reelset_number) : null,
    httpStatus: num(rec.status),
    appStatusCode:
      res.status && typeof res.status === "object"
        ? str((res.status as Record<string, unknown>).code)
        : null,
    startedAt: str(rec.startedAt),
    completedAt: str(rec.completedAt),
    latencyMs: latency(str(rec.startedAt), str(rec.completedAt)),
    parseErrors,
    drift,
    illegalTransition,
    unknownAction,
    raw: rec,
  };
}

function flatten(err: z.ZodError): string {
  return err.issues
    .slice(0, 5)
    .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
    .join("; ");
}
