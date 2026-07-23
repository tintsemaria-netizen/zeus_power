# Zeus Power Protocol Research Bot & Analytics Dashboard

Self-hosted research tooling for **authorized** analysis of the Zeus Power demo game server.
It imports captured protocol traffic, follows the server-driven action flow, normalizes every
event, and (in later phases) serves a live analytics dashboard.

> **Authorization boundary.** For an environment you own or are explicitly authorized to test.
> No auth bypass, token theft, CAPTCHA/anti-bot evasion, proxy rotation, stealth fingerprinting,
> rate-limit evasion, or private-endpoint discovery. Only the demonstrated endpoint, demo token,
> and protocol are used. Rate/concurrency limits, emergency stop, and audit logs are built in.

## Status — Phase: Analyzer MVP (import-only, no network)

Implemented and passing (`packages/core`, 39 tests):

- capture import + endpoint filtering (`/gs/zeus_power/` only);
- Zod schemas for all observed requests/responses (`.passthrough()` — no field is discarded);
- schema-drift detector;
- server-driven state machine + default action policy (`bw_collect`, never `bw_gamble`);
- integer minor-unit money handling (denominator 100);
- derived round / feature-chain correlation (no double counting);
- reproducible statistics (RTP, hit-rate, Wilson 95% CIs);
- `import-capture` and `replay-capture` scripts producing deterministic summaries.

Not yet built (later phases): Fastify API, worker/live collector, PostgreSQL + ClickHouse,
React/Vite/Tailwind dashboard, Docker Compose. See `PROGRESS.md`.

## Requirements

- Node.js ≥ 20 (tested on 24), pnpm ≥ 9.

## Setup & run (Ubuntu)

```bash
# 1. install pnpm if needed
corepack enable && corepack prepare pnpm@latest --activate

# 2. install deps
pnpm install

# 3. place the capture (already staged) at input/capture.json
#    (unzip the supplied export there if starting fresh)

# 4. typecheck + test
pnpm typecheck
pnpm test

# 5. import-only analyzer (no network) -> out/normalized.json, out/import-report.json
pnpm import:capture               # defaults to input/capture.json
pnpm import:capture path/to.json --out out

# 6. deterministic replay validator -> out/replay-summary.json
pnpm replay:capture
```

## Layout

```
input/                 supplied capture (git-ignored)
out/                   generated reports (git-ignored)
docs/                  protocol-analysis, state-machine, known-unknowns
scripts/               import-capture.ts, replay-capture.ts
packages/core/         schemas, normalizer, state machine, correlation, stats + tests
```

## Docs

- [`docs/protocol-analysis.md`](docs/protocol-analysis.md)
- [`docs/state-machine.md`](docs/state-machine.md)
- [`docs/known-unknowns.md`](docs/known-unknowns.md) — `buy_spin`, `set_params`, `bw_gamble`
