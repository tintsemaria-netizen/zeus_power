/**
 * Zod schemas inferred from the real capture. Every object uses `.passthrough()` so
 * unknown/extra fields are NEVER discarded (spec §1.5). Schema drift is detected
 * separately (see drift.ts) by comparing observed keys against the known-key sets.
 *
 * Money-bearing fields are integers in MINOR UNITS (currency_format.denominator = 100).
 * `cash_koef` is a multiplier (float), not money.
 */
import { z } from "zod";

const int = z.number().int();

/* ------------------------------------------------------------------ requests */

export const RequestId = z.string().regex(/^[0-9a-f]{32}$/i, "32-char hex request id");

export const LoginRequest = z
  .object({
    client_command_timestamp: int,
    command: z.literal("login"),
    language: z.string(),
    request_id: RequestId,
    token: z.string(),
  })
  .passthrough();

export const StartRequest = z
  .object({
    client_command_timestamp: int,
    command: z.literal("start"),
    huid: z.string(),
    mode: z.string(),
    request_id: RequestId,
    session_id: z.string(),
  })
  .passthrough();

export const SyncRequest = z
  .object({
    client_command_timestamp: int,
    command: z.literal("sync"),
    prev_client_command_time: int.optional(),
    request_id: RequestId,
    session_id: z.string(),
  })
  .passthrough();

export const PlayAction = z
  .object({
    name: z.string(),
    params: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const PlayRequest = z
  .object({
    action: PlayAction,
    autogame: z.boolean(),
    client_command_timestamp: int,
    command: z.literal("play"),
    fullscreen: z.boolean(),
    mobile: z.string(), // observed as the STRING "0" — preserve the type
    portrait: z.boolean(),
    quick_spin: int,
    request_id: RequestId,
    session_id: z.string(),
    set_denominator: int,
    sound: z.boolean(),
    // client/UI fields that are optional in the capture:
    prev_client_command_time: int.optional(),
    viewportSize: z.string().optional(),
    min_fps: int.optional(),
  })
  .passthrough();

export const AnyRequest = z.union([LoginRequest, StartRequest, SyncRequest, PlayRequest]);

/* ----------------------------------------------------------------- responses */

export const Status = z.object({ code: z.string() }).passthrough();

export const User = z
  .object({
    balance: int, // minor units
    balance_version: int,
    currency: z.string(),
    huid: z.string(),
    is_test: z.boolean(),
    show_balance: z.boolean(),
  })
  .passthrough();

/** Loosely-typed board: array of reels/columns of numeric symbol ids. */
export const Board = z.array(z.array(int));

/**
 * Mode objects (context.spins / freespins / bonus / fist_bonus). Typed loosely with the
 * money/integer fields pinned; everything else passes through so drift is preserved.
 */
export const SpinsMode = z
  .object({
    bet_per_line: int,
    lines: int,
    round_bet: int, // minor units
    round_win: int.optional(), // minor units
    total_win: int.optional(), // minor units
    cash_koef: z.number(), // multiplier (not money)
    bs_count: int,
    reelset_number: int,
    board: Board.optional(),
  })
  .passthrough();

export const FreespinsMode = SpinsMode.extend({
  rounds_granted: int.optional(),
  rounds_left: int.optional(),
}).passthrough();

export const BonusMode = z
  .object({
    bet_per_line: int,
    lines: int,
    round_bet: int,
    round_win: int,
    total_win: int,
    cash_koef: z.number(),
    bg_type: int,
    bs_count: int,
    keys: int,
    threshold_num: int,
    rounds_granted: int,
    rounds_left: int,
    from_freespin: z.boolean(),
    reelset_number: int,
    board: Board.optional(),
  })
  .passthrough();

export const FistBonusMode = z
  .object({
    bet_per_line: int,
    lines: int,
    round_bet: int,
    total_win: int,
    bs_count: int,
    fist_bg_type: int,
    fist_bs_count: int,
    fist_mult_win: int,
    fist_round_win: int,
    fist_rounds_left: int,
    board: Board.optional(),
  })
  .passthrough();

export const Context = z
  .object({
    current: z.string(),
    actions: z.array(z.string()),
    version: int,
    last_action: z.string().nullable().optional(),
    last_args: z.unknown().optional(),
    last_win: z.unknown().optional(),
    round_finished: z.boolean(),
    achievements: z.unknown().optional(),
    available_buy_bonus: z.unknown().optional(),
    spins: SpinsMode.optional(),
    freespins: FreespinsMode.optional(),
    bonus: BonusMode.optional(),
    fist_bonus: FistBonusMode.optional(),
  })
  .passthrough();

export const GameResponse = z
  .object({
    command: z.string(),
    status: Status,
    request_id: RequestId,
    session_id: z.string(),
    user: User,
    modes: z.unknown().optional(),
    context: Context.optional(), // absent on sync responses
    settings: z.unknown().optional(), // present only on start
    origin_data: z.unknown().optional(), // present on play
  })
  .passthrough();

export type TLoginRequest = z.infer<typeof LoginRequest>;
export type TStartRequest = z.infer<typeof StartRequest>;
export type TSyncRequest = z.infer<typeof SyncRequest>;
export type TPlayRequest = z.infer<typeof PlayRequest>;
export type TContext = z.infer<typeof Context>;
export type TGameResponse = z.infer<typeof GameResponse>;
export type TUser = z.infer<typeof User>;
