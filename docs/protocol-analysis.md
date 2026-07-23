# Zeus Power — Protocol Analysis

> Generated from the supplied packet capture (`input/capture.json`). Every figure below is
> derived from real packets; assumptions are marked **ASSUMPTION**. Secrets are redacted.
> Scope: authorized demo research only. No auth bypass, evasion, or endpoint discovery.

## 1. Endpoint & command inventory

- **Authorized endpoint:**
  `https://betman-demo.head.kendoo.pro/betman-demo/gs/zeus_power/desktop/611495f06ee84c71b12dae70001923ec/demo/`
- Filter marker used by the importer: `/gs/zeus_power/` + `POST` + a `gsc` query param.
- The capture holds **963 total records**; **870** are the Zeus Power endpoint. **93** are
  unrelated traffic (excluded): `chatgpt.com`, `a-api.anthropic.com`, Google/Yandex analytics,
  `browser-intake-us5-datadoghq.com`, `m.stripe.com`, `accounts.google.com`, etc.

Top-level commands (via `?gsc=`):

| `gsc`   | count | purpose |
|---------|------:|---------|
| `play`  |   854 | all in-game actions (envelope `command:"play"`, `action:{name,params}`) |
| `sync`  |    14 | balance/session refresh; **no `context`** in response |
| `login` |     1 | obtain `session_id` + `user.huid` |
| `start` |     1 | initial `context`, `settings`, balance, paytable, symbols, paylines, jackpots |

## 2. Request schemas (observed field types)

### `?gsc=login`
```json
{ "client_command_timestamp": 1784802178267, "command": "login",
  "language": "en", "request_id": "<32-hex>", "token": "REDACTED" }
```

### `?gsc=start`
```json
{ "client_command_timestamp": 1784802178451, "command": "start",
  "huid": "<from login>", "mode": "auto", "request_id": "<32-hex>", "session_id": "<from login>" }
```

### `?gsc=sync`
```json
{ "client_command_timestamp": 1784802174567, "command": "sync",
  "prev_client_command_time": 57, "request_id": "<32-hex>", "session_id": "<active>" }
```
`prev_client_command_time` is a **client timing field** (measured elapsed ms), not a game input.
It is absent on 1 of 14 sync records. **ASSUMPTION:** it may be omitted on the first call.

### `?gsc=play` (envelope)
```json
{ "action": {"name":"spin","params":{"bet_per_line":5,"lines":20}},
  "autogame": true, "client_command_timestamp": 1784802224162, "command": "play",
  "fullscreen": true, "mobile": "0", "portrait": false, "quick_spin": 2,
  "request_id": "<32-hex>", "session_id": "<active>", "set_denominator": 1,
  "sound": true, "prev_client_command_time": 65 }
```
Type notes (preserve exactly): `mobile` is the **string** `"0"`. Optional/rare client fields:
`viewportSize` (seen once), `min_fps` (6×), `prev_client_command_time` (853/854).

Only `spin` carries `action.params` (`bet_per_line`, `lines`). All other actions send
`params:{}` / none. `buy_spin`, `set_params`, `bw_gamble` were **never sent** — see
[known-unknowns](known-unknowns.md).

## 3. Response schema

Top-level keys (present in all 870): `command`, `status`, `request_id`, `session_id`, `user`,
`modes`. Conditional: `context` (855; absent on sync), `settings` (start only), `origin_data`
(854, on play). `status` is always `{"code":"OK"}` in this capture.

`user`: `balance` (int, minor units), `balance_version` (int), `currency`, `huid`, `is_test`,
`show_balance`.

`context`: `current`, `actions[]`, `version`, `last_action`, `last_args`, `last_win`,
`round_finished`, `achievements`, `available_buy_bonus`, plus one mode object named after the
current state.

### Mode objects (fields observed)
- **`spins` / `freespins`**: `bet_per_line`, `lines`, `round_bet`, `round_win`, `total_win`,
  `cash_koef` (float multiplier — *not money*), `board`, `bs`, `bs_count`, `reelset_number`,
  `wild_drop`, `winlines`, `winscatters`, `client`. `freespins` adds `rounds_granted`,
  `rounds_left`. Undocumented-but-present: `bg_stop` (spins).
- **`bonus`**: adds `bg_type`, `board_spins`, `keys`, `threshold_num`, `from_freespin`,
  `new_bs`, `fist_bg`, `bs_from_fist`; `board` is the 5×8 progression board.
- **`fist_bonus`** (exact spelling): `fist_bg_type`, `fist_bs_count`, `fist_mult_win`,
  `fist_round_win`, `fist_rounds_left`, `fist_bs`, `fist_new_bs`.

> Fields not in the original brief but present in packets and therefore retained (never
> discarded): `bg_stop`, `bg_type`, `threshold_num`, `new_bs`, `fist_new_bs`, `min_fps`,
> `origin_data`. They are registered in the drift known-key sets so future *new* fields raise
> an alert.

## 4. Money & units

`currency_format = { denominator: 100, currency_style: "symbol", style: "money" }`.
All monetary fields (`balance`, `round_bet`, `round_win`, `total_win`, `last_win`) are
**integer minor units**. The pipeline keeps them as integers and only divides by 100 for
display. `cash_koef` is a float multiplier and is never treated as money.

## 5. Game configuration (from `start.settings`)

- `cols: 5`, `rows: 4`, 20 fixed `paylines`; `lines: [20]`; `bet_factor: [20]`.
- `bets: [1,2,3,4,5,6,7,10,11,15,17,20,25,30,35,50,55,75,100,105]`.
- `buy_bonus_prices: {"1":100,"2":300}`; `key_thresholds: [10,15,20,25]`.
- `jackpots` (×total bet → tier): `10→mini, 20→minor, 40→midi, 80→major, 1000→grand, 10000→royal`.
- 12 `symbols`: ids 1–8 line, 9 wild, 10 scatter, 11 bonus, 12 hidden.
- `bs_values_reels` keys: `0,1,2,3,4,5,10,20,40,80,1000,0.5` (bonus symbol values incl. jackpots).
- `reelsamples`: `spins_0..7`, `freespins_0..1` (reelset ids).

## 6. State machine (observed)

States: `spins` (788), `bonus` (40), `fist_bonus` (17), `freespins` (10). See
[state-machine.md](state-machine.md) for the Mermaid diagram. All 22 observed
`(last_action → current / actions)` transitions are encoded and validated in code; the full
replay found **0 illegal transitions**.

Distinct advertised action sets: `[spin,buy_spin,set_params]` (779), `[respin]` (34),
`[mini_bonus_pick]` (15), `[freespin]` (8), `[bw_gamble,bw_collect]` (5), `[bonus_init]` (4),
`[bonus_spins_stop]` (3), `[mini_bonus_init]` (2), `[mini_bonus_stop]` (2),
`[freespin_init]` (1), `[bonus_freespins_stop]` (1), `[freespin_stop]` (1).

## 7. Captured vs uncaptured branches

**Captured** request bodies: `spin`, `freespin_init`, `freespin`, `freespin_stop`,
`bonus_init`, `respin`, `bonus_spins_stop`, `bonus_freespins_stop`, `mini_bonus_init`,
`mini_bonus_pick`, `mini_bonus_stop`, `bw_collect`, plus `login`/`start`/`sync`.

**Advertised but never captured** (do not send): `buy_spin`, `set_params`, `bw_gamble`.

## 8. Replay result (this pipeline over the full capture)

`out/replay-summary.json`: 870 zeus records → 854 play exchanges → **779 derived rounds**
(feature chains collapsed onto their originating spin), 1 round with a detected anomaly,
0 parse errors / 0 drift / 0 illegal transitions / 0 unknown actions. Empirical RTP over this
779-spin sample ≈ **0.535** — a *small-sample empirical* figure, **not** the theoretical RNG RTP.
