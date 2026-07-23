/**
 * Monetary helpers. Response money fields are INTEGER MINOR UNITS with
 * currency_format.denominator = 100 (spec §7). We never use binary floating point for
 * monetary totals: amounts stay as integers (minor units) and are only divided by the
 * denominator for DISPLAY.
 */

export interface CurrencyFormat {
  denominator: number;
  currency_style?: string;
  style?: string;
}

export const DEFAULT_CURRENCY_FORMAT: CurrencyFormat = {
  denominator: 100,
  currency_style: "symbol",
  style: "money",
};

/** Assert a value is a safe integer amount in minor units; throws on float/NaN money. */
export function assertMinorUnits(value: number, field: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`monetary field ${field} is not an integer (minor units): ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`monetary field ${field} exceeds safe integer range: ${value}`);
  }
  return value;
}

/** Convert minor units to a major-unit number for DISPLAY ONLY. Do not use for math. */
export function toMajorUnits(minor: number, fmt: CurrencyFormat = DEFAULT_CURRENCY_FORMAT): number {
  return minor / fmt.denominator;
}

/** Multiplier of an amount over the total bet (xBet), as a float ratio. Bet in minor units. */
export function xBet(amountMinor: number, totalBetMinor: number): number {
  if (totalBetMinor === 0) return 0;
  return amountMinor / totalBetMinor;
}

/** Total bet in minor units = bet_per_line * lines * bet_factor. */
export function totalBet(betPerLine: number, lines: number, betFactor = 1): number {
  return betPerLine * lines * betFactor;
}
