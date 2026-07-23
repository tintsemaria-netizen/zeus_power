# Known Unknowns

Actions advertised by the server but **never captured** as request bodies. Their exact request
contract is unknown, so the bot **must not send them** until a real packet is imported and the
schema is approved (spec §6, §19). Attempting them is treated as a `stop` decision.

| Action | Where advertised | Why blocked |
|---|---|---|
| `buy_spin` | always alongside `[spin, …, set_params]` in `spins` | no request body ever sent; params unknown |
| `set_params` | same set as above | no request body; unknown which params it accepts |
| `bw_gamble` | `[bw_gamble, bw_collect]` after a qualifying spin (5×) | no request body; gamble contract unknown; **disabled by default**, `bw_collect` chosen instead |

## To unblock (any of these)

1. Import a capture that contains a real request body for the action.
2. Add its schema to `packages/core/src/protocol/schemas.ts` and mark `captured: true` in
   `constants.ts` `ACTIONS`.
3. Add its legal transitions to `OBSERVED_TRANSITIONS`.
4. Add fixtures + tests before enabling it in any live policy.

## Other open items

- `bs_from_fist` bonus field appears only twice; its full shape across all outcomes is
  under-sampled.
- `min_fps`, `bg_stop`, `origin_data` are retained but their semantics are inferred, not
  documented by the server.
- Jackpot-tier award packets (grand/royal) do not appear in this capture; tier attribution is
  modelled from `settings.jackpots` multipliers, not from observed jackpot wins.
