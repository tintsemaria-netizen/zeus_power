# Claude Code Master Prompt — Zeus Power Protocol Research Bot & Analytics Dashboard

You are Claude Code acting as a senior iGaming protocol engineer, data engineer, backend architect, frontend engineer, QA engineer, and security reviewer.

Build a production-quality, self-hosted application that can run authorized research sessions against the Zeus Power demo game server, follow the server-driven action flow exactly, store every request/response and normalized game event, and display live mathematical/statistical analysis in a dashboard.

## 0. Authorization and safety boundary

This tool is for an environment I own or am explicitly authorized to test. Do not add authentication bypasses, token theft, CAPTCHA bypass, anti-bot evasion, proxy rotation, stealth fingerprinting, rate-limit evasion, or attempts to discover private endpoints. Use only the endpoint, demo token, and protocol demonstrated in the supplied packet capture. Add configurable rate limits, concurrency limits, emergency stop, and audit logs.

## 1. Source material and first task

The repository/input folder contains a captured network export JSON with approximately 963 POST records. About 870 records belong to the Zeus Power game API endpoint:

`https://betman-demo.head.kendoo.pro/betman-demo/gs/zeus_power/desktop/611495f06ee84c71b12dae70001923ec/demo/`

The URL uses a `gsc` query parameter for top-level commands such as `login`, `start`, and `sync`.

Before writing the bot:

1. Locate and parse the supplied packet capture.
2. Filter only the Zeus Power game endpoint and exclude ChatGPT, analytics, browser telemetry, Datadog, Google, Yandex, and unrelated traffic.
3. Generate `docs/protocol-analysis.md` containing:
   - endpoint and command inventory;
   - request/response schemas inferred from real packets;
   - state transition diagram;
   - all observed `context.current`, `context.actions`, and `last_action` combinations;
   - field glossary and units;
   - examples with secrets redacted;
   - captured and uncaptured branches;
   - assumptions clearly marked as assumptions.
4. Generate JSON Schema or Zod schemas from the observed payloads.
5. Never silently discard unknown fields. Store raw payloads and surface schema drift.

## 2. Confirmed protocol facts from the capture

### Top-level lifecycle

Observed flow:

`login -> start -> server-driven play actions`

Additional `sync` calls occur independently and return current user balance/session information.

### Login request

Query: `?gsc=login`

Observed body shape:

```json
{
  "client_command_timestamp": 1784802178267,
  "command": "login",
  "language": "en",
  "request_id": "32-character-hex-id",
  "token": "demo100000"
}
```

The login response provides `session_id` and `user.huid`.

### Start request

Query: `?gsc=start`

```json
{
  "client_command_timestamp": 1784802178451,
  "command": "start",
  "huid": "value-from-login-response",
  "mode": "auto",
  "request_id": "32-character-hex-id",
  "session_id": "value-from-login-response"
}
```

The start response provides initial `context`, `settings`, user balance, available actions, paytable, symbols, paylines, jackpot mapping, bet options, and buy-bonus prices.

### Sync request

Query: `?gsc=sync`

```json
{
  "client_command_timestamp": 1784802174567,
  "command": "sync",
  "prev_client_command_time": 57,
  "request_id": "32-character-hex-id",
  "session_id": "active-session-id"
}
```

Treat `prev_client_command_time` as an observed client timing field, not a mathematical game input. Generate a reasonable measured elapsed time; do not copy a fixed value.

### Play request envelope

All game actions use `command: "play"` and an `action` object:

```json
{
  "action": {"name": "spin", "params": {"bet_per_line": 5, "lines": 20}},
  "autogame": true,
  "client_command_timestamp": 1784802224162,
  "command": "play",
  "fullscreen": true,
  "mobile": "0",
  "portrait": false,
  "prev_client_command_time": 65,
  "quick_spin": 2,
  "request_id": "32-character-hex-id",
  "session_id": "active-session-id",
  "set_denominator": 1,
  "sound": true,
  "viewportSize": "984x952"
}
```

Preserve the observed types, including `mobile` being the string `"0"`. Make optional UI/client fields configurable. Use monotonic timestamps and unique request IDs.

## 3. Server-driven state machine — mandatory behavior

The server response is authoritative. The bot must never decide the next protocol action solely from local assumptions.

For every response:

1. Read `context.current`.
2. Read `context.actions`.
3. Read `context.version`.
4. Read `context.last_action`, `context.last_args`, and `context.round_finished`.
5. Select only an action advertised by `context.actions`.
6. Validate that the selected action is legal for the current state.
7. Record expected action, selected action, transition result, and any mismatch.
8. Stop safely on unknown state/action unless an explicit configured policy handles it.

Preserve the exact observed state spelling `fist_bonus`; do not “correct” it to `first_bonus`.

### Observed states

- `spins`
- `freespins`
- `bonus`
- `fist_bonus`

### Observed actions

- `spin`
- `buy_spin` — advertised but no request body was captured; do not invent it
- `set_params` — advertised but no request body was captured; do not invent it
- `freespin_init`
- `freespin`
- `freespin_stop`
- `bonus_init`
- `respin`
- `bonus_spins_stop`
- `bonus_freespins_stop`
- `mini_bonus_init`
- `mini_bonus_pick`
- `mini_bonus_stop`
- `bw_gamble` — advertised but no request body was captured; disabled by default
- `bw_collect`

### Confirmed transition patterns

Implement and test at least these transitions:

- `start -> current=spins, actions=[spin,buy_spin,set_params]`
- `spin -> spins/[spin,buy_spin,set_params]`
- `spin -> spins/[freespin_init]`
- `freespin_init -> freespins/[freespin]`
- `freespin -> freespins/[freespin]`
- `freespin -> freespins/[bonus_init]`
- `bonus_init -> bonus/[respin]`
- `respin -> bonus/[respin]`
- `respin -> bonus/[mini_bonus_init]`
- `mini_bonus_init -> fist_bonus/[mini_bonus_pick]`
- `mini_bonus_pick -> fist_bonus/[mini_bonus_pick]`
- `mini_bonus_pick -> fist_bonus/[mini_bonus_stop]`
- `mini_bonus_stop -> bonus/[bonus_spins_stop]`
- `respin -> bonus/[bonus_spins_stop]`
- `respin -> bonus/[bonus_freespins_stop]`
- `bonus_freespins_stop -> freespins/[freespin]`
- `bonus_spins_stop -> spins/[spin,buy_spin,set_params]`
- `freespin -> freespins/[freespin_stop]`
- `freespin_stop -> spins/[spin,buy_spin,set_params]`
- `spin -> spins/[bw_gamble,bw_collect]`
- `bw_collect -> spins/[spin,buy_spin,set_params]`

When both `bw_gamble` and `bw_collect` are offered, choose `bw_collect` by default. The dashboard may expose an explicit, disabled-by-default experimental gamble policy only after its exact request contract is captured and approved.

## 4. Game configuration discovered in start response

Parse dynamically from `settings`; do not hardcode as the only source of truth. Use these captured values as validation expectations:

- 5 columns, 4 base rows, 20 fixed paylines.
- `bet_factor: [20]`.
- `bets: [1,2,3,4,5,6,7,10,11,15,17,20,25,30,35,50,55,75,100,105]`.
- `buy_bonus_prices: {"1":100,"2":300}`.
- `key_thresholds: [10,15,20,25]` for unlocking rows 5–8.
- Jackpot multipliers:
  - mini 10x total bet;
  - minor 20x;
  - midi 40x;
  - major 80x;
  - grand 1000x;
  - royal 10000x.
- Symbols:
  - IDs 1–8: line symbols;
  - ID 9: wild;
  - ID 10: scatter;
  - ID 11: bonus;
  - ID 12: hidden.
- Scatter: 3 occurrences pays 2x total bet and grants 8 free spins.
- Free spins may retrigger with 2+ scatters granting 3+ additional spins according to observed rules/screenshots; calculate from response fields rather than assuming exact increments if the packet provides them.
- Bonus starts with 3 respins; a new bonus symbol resets respins to 3; additional rows unlock at 10/15/20/25 collected bonus symbols; maximum board is 5x8 = 40 cells.
- Collecting all 40 bonus symbols awards Royal Jackpot.
- Bonus symbol regular values shown in rules: 0.5x, 1x, 1.5x, 2x, 3x, 4x, 5x total bet.
- Zeus Power/fist symbol can trigger a separate six-reel mini-feature; after all six positions fill, a center multiplier can be 2x/3x/5x/10x and applies to collected values. Derive actual outcomes from `fist_bonus`, `fist_bg`, `bs_from_fist`, and related fields.

## 5. Bot operating modes

Implement these modes:

### A. Import-only analyzer

Imports captured packet JSON without sending network requests. This must work first and provide immediate analytics from historical captures.

### B. Live authorized collector

Starts a fresh demo session via login/start and continuously follows server-advertised actions.

### C. Replay validator

Replays normalized captured responses through the parser/state machine without contacting the server, verifying deterministic parsing and transitions.

### D. Manual action inspector

Allows an operator to pause and inspect the currently advertised actions. The operator can select only a server-advertised, fully supported action.

Do not implement uncontrolled high-concurrency load generation. Default concurrency is 1 session. Hard maximum is configurable and conservative. Add request delay/jitter only for server protection, not evasion.

## 6. Action policy

Default policy:

- When `spin` is offered, send spin using configured legal `bet_per_line` and `lines=20`.
- When exactly one mandatory continuation action is offered (`freespin_init`, `freespin`, `bonus_init`, `respin`, `mini_bonus_init`, `mini_bonus_pick`, `mini_bonus_stop`, `bonus_spins_stop`, `bonus_freespins_stop`, `freespin_stop`), send it.
- When `[bw_gamble,bw_collect]` is offered, send `bw_collect`.
- Never call `buy_spin`, `set_params`, or `bw_gamble` until their exact request packets have been imported and schema-approved.
- If an unknown action appears, persist the response, mark schema drift, pause that worker, and show a critical dashboard alert.
- Respect `round_finished`; never start a fresh spin while a feature round remains unfinished.

## 7. Data model and storage

Use:

- Backend: Node.js + TypeScript + Fastify.
- Worker: Node.js + TypeScript, separate process/service.
- Transactional/config DB: PostgreSQL.
- High-volume events/analytics: ClickHouse.
- Frontend: React + Vite + TypeScript + Tailwind CSS.
- Charts: Apache ECharts or Recharts.
- Live updates: WebSocket or Server-Sent Events.
- Deployment: Docker Compose, with optional systemd examples and Nginx reverse proxy.

### PostgreSQL responsibilities

Store:

- users and local authentication;
- bot profiles;
- endpoint configurations;
- encrypted demo tokens/secrets;
- run definitions and run status;
- worker leases/heartbeats;
- alert rules;
- imported file metadata;
- schema versions;
- audit log;
- UI preferences.

### ClickHouse responsibilities

Create optimized tables/materialized views for:

- raw HTTP exchanges;
- normalized commands/actions;
- sessions;
- game rounds;
- base spins;
- free spins;
- bonus respins;
- fist/Zeus Power mini-bonus picks;
- bonus symbols;
- boards/cells;
- line wins;
- scatter wins;
- jackpots;
- state transitions;
- errors/schema drift;
- periodic aggregate snapshots.

Every normalized event must retain links to `run_id`, `session_id`, `request_id`, exchange ID, round ID (derived if absent), feature chain ID, timestamp, context version, and raw payload.

Use `Decimal`/integer minor units for money. Never use binary floating point for monetary totals. The captured currency format uses denominator 100, and response monetary fields appear in integer minor units. Normalize both raw amount and total-bet multiplier.

## 8. Round and feature correlation

The packets do not expose a simple explicit round ID in every response. Build a robust derived correlation model:

- Start a base round on a legal `spin` action.
- Keep the same feature-chain ID while `round_finished=false`.
- Attach free spins, bonus game, fist mini-feature, stop actions, and big-win collect to the originating base spin.
- Close the derived round only when `round_finished=true` and normal spin actions return.
- Persist the derivation algorithm version.
- Detect session reset, start response, reconnect, duplicate request, and out-of-order response.

## 9. Normalization requirements

Parse and normalize all observed structures, including unknown extra fields:

### Common context

- `achievements`
- `actions`
- `available_buy_bonus`
- `current`
- `last_action`
- `last_args`
- `last_win`
- `round_finished`
- `version`

### Base/free-spin structures

- `bet_per_line`
- `lines`
- `round_bet`
- `round_win`
- `total_win`
- `board`
- `reelset_number`
- `wild_drop`
- `cash_koef`
- `bs`, `bs_count`
- `winlines`
- `winscatters`
- `rounds_granted`
- `rounds_left`
- `client`
- `bw_gamble`

### Bonus structures

- `bg_type`
- 5x8 bonus `board`
- `board_spins`
- `bs`, including `reel`, `position`, `type`, `value`, `from_fist_bg`
- `keys`
- unlocked rows / active cells
- respins remaining (discover exact field names across all samples)
- `from_freespin`
- `fist_bg`
- `bs_from_fist`
- jackpot symbol types and awards

### Fist/Zeus Power mini-feature

- `fist_bg_type`
- `fist_bs_count`
- `fist_mult_win`
- `fist_round_win`
- `fist_rounds_left`
- mini-board state
- individual picks/spins
- final transferred value

Create parser fixtures for every distinct response shape in the capture.

## 10. Statistical definitions — must be explicit and reproducible

The dashboard must display both point estimates and sample sizes. For rates, show Wilson 95% confidence intervals where appropriate. Clearly label empirical observed statistics; do not claim they are the theoretical RNG probabilities.

Calculate at minimum:

### Core economics

- total wager;
- total payout;
- empirical RTP = payout / wager;
- GGR = wager - payout;
- base-game RTP contribution;
- free-spin RTP contribution;
- bonus-game RTP contribution;
- jackpot RTP contribution;
- fist-feature RTP contribution;
- big-win/gamble contribution;
- bought-bonus RTP separately when later supported;
- average win per spin;
- median and percentiles of win multiplier;
- maximum observed win and max win in xBet;
- volatility: standard deviation of return per paid spin;
- variance and coefficient of variation;
- bankroll curve and drawdown.

Avoid double counting feature payouts. Attribute the final feature-chain payout to the original paid spin while also presenting component contributions.

### Frequencies

- paid-spin hit frequency: percentage of paid spins with final return > 0;
- immediate base-spin hit frequency;
- feature-adjusted hit frequency;
- scatter trigger frequency;
- free-spin trigger frequency and average paid spins per trigger;
- free-spin retrigger frequency;
- average free spins granted/played;
- bonus trigger frequency;
- bonus triggered from base vs free spins;
- fist/Zeus Power feature frequency;
- big-win offer frequency;
- jackpot hit frequency by tier;
- Royal full-board frequency;
- row-unlock frequency at 10/15/20/25 keys;
- bonus completion distribution by collected-symbol count;
- respin count distribution and average resets;
- probability of each observed `context.actions` set;
- state transition frequency and transition error rate.

### Symbol and board analytics

For base spins and free spins separately, and grouped by reelset number:

- symbol frequency by symbol ID/name;
- symbol frequency per reel and row;
- visible stop/board pattern frequency;
- bonus symbol count distribution (`bs_count`);
- scatter occurrence distribution;
- wild occurrence and wild-drop frequency;
- line-win frequency by line index;
- win frequency by symbol and match length;
- payout contribution by symbol;
- board heatmaps;
- pair/correlation indicators, clearly labeled empirical and not proof of RNG dependence.

For bonus:

- bonus symbol type frequency (`regular`, `mini`, `minor`, `midi`, `major`, `grand`, `royal`, `fist`, and unknown types);
- regular bonus value frequency in absolute amount and xBet;
- landing probability by reel/position and by active row;
- new-symbol probability per respin conditional on empty-cell count;
- reset probability;
- keys progression;
- final collected symbol distribution;
- final feature payout distribution;
- jackpot contribution and probability by tier;
- fist placement and outcome distribution;
- multiplier outcome distribution.

### Protocol health

- requests/sec;
- latency p50/p95/p99;
- HTTP status counts;
- application status codes;
- retry count;
- duplicate request IDs;
- session expiry/relogin count;
- unknown actions;
- schema drift;
- illegal transition attempts;
- response/action mismatch;
- worker heartbeat and last successful response.

## 11. Dashboard information architecture

Create a premium dark desktop-first dashboard suitable for slot math research. Keep the sidebar clean; use main categories with accordion submenus.

Pages:

1. **Overview**
   - bot status and emergency stop;
   - active run/session;
   - paid spins, completed rounds, wager, payout, RTP, hit rate, bonus frequency, free-spin frequency, max win;
   - confidence intervals and sample size;
   - live RTP convergence chart;
   - cumulative wager/payout/GGR;
   - recent alerts.

2. **Runs**
   - create/import/start/pause/resume/stop run;
   - rate and bet configuration;
   - run comparison;
   - progress and worker health.

3. **Protocol Explorer**
   - request/response timeline;
   - state/action graph;
   - current server-advertised actions;
   - raw JSON viewer with diff;
   - search by session/request/derived round;
   - unknown-field and schema-drift viewer.

4. **RTP & Wins**
   - RTP convergence;
   - RTP by component and reelset;
   - win multiplier histogram/log-scale tail;
   - hit-rate breakdown;
   - max-win records;
   - confidence interval panel.

5. **Base Game**
   - symbol/reel/row heatmaps;
   - line-win analytics;
   - scatter and wild analytics;
   - reelset comparison.

6. **Free Spins**
   - triggers, retriggers, rounds granted/played;
   - RTP contribution;
   - symbol and win distributions;
   - bonus-during-free-spins chains.

7. **Bonus Game**
   - trigger rate;
   - 5x8 board progression visualization;
   - keys and unlocked-row funnel;
   - respin/reset distributions;
   - bonus symbol/value heatmaps;
   - final collected count and payout.

8. **Zeus Power Feature**
   - trigger frequency;
   - six-reel mini-feature progression;
   - fist types;
   - multiplier distribution;
   - transferred win and contribution.

9. **Jackpots**
   - Mini/Minor/Midi/Major/Grand/Royal counts, rates, contribution, average interval;
   - full-board Royal events;
   - empirical confidence intervals.

10. **Data Quality**
    - missing fields;
    - malformed packets;
    - duplicate/out-of-order events;
    - reconciliation failures;
    - raw-vs-normalized amount checks;
    - schema versions.

11. **Settings & Audit**
    - endpoint, token secret reference, limits, retention, users;
    - immutable audit log.

All filters should support run, time range, session, mode, reelset, bet, state, action, feature source, and jackpot tier.

## 12. Live visualization

Provide:

- current board rendering from numeric symbol IDs;
- current bonus 5x8 board with locked/unlocked rows;
- occupied/empty cells and landed symbol values;
- current free-spin counter;
- current respin counter;
- current state, last action, next advertised actions;
- current derived round and feature-chain total;
- event stream updating without full-page refresh.

Use placeholders or generated labels for symbol art if actual assets are unavailable. Do not scrape copyrighted assets from the live game.

## 13. API design

Create documented internal APIs, including:

- authentication;
- upload/import capture;
- runs CRUD and control;
- run status/heartbeat;
- protocol exchanges search/detail;
- rounds search/detail;
- statistics summary;
- time series;
- symbols/heatmaps;
- features/free spins/bonus/fist/jackpots;
- data quality;
- export CSV/JSON/Parquet where practical;
- live SSE/WebSocket stream.

Generate OpenAPI documentation.

## 14. Reliability and reconciliation

Implement:

- unique request IDs;
- request timeout and bounded retries only for safe network failures;
- no blind retry of ambiguous completed game actions without reconciliation;
- session recovery using sync/start as supported by observed behavior;
- idempotent ingestion keyed by capture record/exchange/request IDs;
- raw payload compression;
- graceful shutdown;
- worker lease and heartbeat;
- checkpointing;
- stop conditions: maximum paid spins, maximum wager, maximum runtime, error threshold, unknown action, balance threshold;
- balance reconciliation using response `user.balance` and `balance_version`;
- amount reconciliation between `last_win`, mode-level `round_win/total_win`, line/scatter wins, bonus symbols, and feature finalization;
- alert whenever sums do not reconcile, without altering raw data.

## 15. Security

- Local username/password authentication with Argon2id.
- Role-based access: owner, analyst, operator, viewer.
- Encrypt secrets at rest; never return tokens to frontend after save.
- Redact authorization/token/session fields in logs and exports by default.
- CSRF protection where applicable, secure cookies, rate limits, validation, security headers.
- No arbitrary URL fetching from the frontend; endpoint allowlist.
- Audit every run control/configuration/export action.

## 16. Tests

Create:

- unit tests for every parser and monetary conversion;
- fixtures for all observed actions and states;
- state-machine transition tests;
- illegal/unknown transition tests;
- round-correlation tests;
- RTP/no-double-counting tests;
- property tests for board dimensions and position bounds;
- import idempotency tests;
- API integration tests;
- Playwright dashboard smoke tests;
- a replay test that processes the entire supplied capture and produces a deterministic summary.

The CI pipeline must run lint, typecheck, unit/integration tests, and build.

## 17. Required deliverables

Create:

- working monorepo;
- `docker-compose.yml`;
- `.env.example` without secrets;
- database migrations;
- ClickHouse DDL/materialized views;
- OpenAPI spec;
- `README.md` with exact Ubuntu setup commands;
- `docs/protocol-analysis.md`;
- `docs/state-machine.md` with Mermaid diagram;
- `docs/statistics-definitions.md`;
- `docs/data-model.md`;
- `docs/security.md`;
- `docs/known-unknowns.md` listing uncaptured `buy_spin`, `set_params`, and `bw_gamble` bodies;
- `scripts/import-capture.ts`;
- `scripts/replay-capture.ts`;
- test summary generated from the provided capture.

## 18. Execution plan

Work autonomously in phases and do not stop after writing a plan:

1. Inspect files and produce protocol report.
2. Scaffold monorepo and infrastructure.
3. Implement capture importer and schemas.
4. Implement normalizer and state machine.
5. Run full replay over supplied capture and fix all parser failures.
6. Implement PostgreSQL/ClickHouse persistence.
7. Implement authorized live collector with safe defaults.
8. Implement APIs.
9. Implement dashboard.
10. Add tests, docs, Docker deployment, and QA.

After each phase, run the relevant tests and write progress to `PROGRESS.md`.

## 19. Non-negotiable acceptance criteria

- The supplied capture imports without crashing.
- Every Zeus Power packet is preserved raw.
- All observed action/state shapes are parsed or explicitly marked unknown.
- The bot follows only actions returned by `context.actions`.
- The exact `fist_bonus` state spelling is supported.
- Feature chains are correlated to originating paid spins.
- RTP and feature contributions do not double count.
- Dashboard statistics show sample sizes and definitions.
- Unknown action/schema drift pauses the worker safely and creates an alert.
- No uncaptured action body is invented.
- Default big-win behavior is `bw_collect`, not `bw_gamble`.
- One-command local startup works with Docker Compose.

Begin now by inspecting the supplied packet file and writing `docs/protocol-analysis.md`, then continue through implementation without waiting for additional confirmation unless an authorization-sensitive action would exceed the stated endpoint and demo protocol.
