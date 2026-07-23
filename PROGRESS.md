# Progress

Phase plan per the master prompt §18. This build targets the **Analyzer MVP** first (the
spec's "must work first" import-only analyzer), structured as a monorepo that grows into the
full stack.

## Done

- [x] **Phase 1 — Inspect capture + protocol report.** Parsed all 963 records, isolated 870
      zeus_power packets, extracted request/response/transition shapes from real data. Wrote
      `docs/protocol-analysis.md`, `docs/state-machine.md`, `docs/known-unknowns.md`.
- [x] **Phase 2 (partial) — Scaffold.** pnpm workspace monorepo, `@zeus/core` TS package,
      tsconfig/vitest wiring. (Infra services — Postgres/ClickHouse/Docker — deferred.)
- [x] **Phase 3 — Importer + schemas.** `filterCapture`, Zod schemas (`.passthrough()`),
      drift detector. 19 fixtures saved (one per command / action / state).
- [x] **Phase 4 — Normalizer + state machine.** `normalizeExchange`, `OBSERVED_TRANSITIONS`,
      `decideAction` policy, integer minor-unit money, round/feature-chain correlation.
- [x] **Phase 5 — Full replay.** `replay-capture.ts` over the whole capture: 0 parse errors,
      0 drift, 0 illegal transitions, 0 unknown actions; 779 derived rounds; deterministic
      summary in `out/replay-summary.json`. 39 unit/integration tests pass.

## Next (not started)

- [ ] **Phase 6 — Persistence.** PostgreSQL migrations (users, profiles, runs, audit) +
      ClickHouse DDL/materialized views for raw exchanges, normalized events, rounds, spins,
      bonus, fist picks, jackpots, transitions, drift.
- [ ] **Phase 7 — Live authorized collector.** Worker process, login/start/sync loop, safe
      defaults (concurrency 1, jitter, emergency stop, stop conditions, balance reconciliation).
- [ ] **Phase 8 — APIs.** Fastify + OpenAPI: import, runs CRUD/control, exchanges/rounds
      search, stats/timeseries, features, data-quality, exports, SSE/WebSocket stream.
- [ ] **Phase 9 — Dashboard.** React + Vite + Tailwind + ECharts; 11 pages per spec §11.
- [ ] **Phase 10 — Tests, docs, Docker, QA.** docker-compose, Playwright smokes, CI pipeline.

## Acceptance criteria met so far

- [x] Supplied capture imports without crashing.
- [x] Every zeus_power packet preserved raw (`NormalizedExchange.raw`).
- [x] All observed action/state shapes parsed; unknown fields surfaced, never dropped.
- [x] Bot follows only `context.actions`; exact `fist_bonus` spelling supported.
- [x] Feature chains correlated to originating paid spins; no double counting.
- [x] Stats show sample sizes + Wilson CIs; empirical (not theoretical) clearly labeled.
- [x] Unknown action / drift => `stop` decision (worker pause + alert hook).
- [x] No uncaptured action body invented; default big-win = `bw_collect`.
- [ ] One-command Docker Compose startup (Phase 10).
