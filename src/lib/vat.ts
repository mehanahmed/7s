/** VAT on an amount (already net of discount), rounded to 2 decimals. */
export const vatAmountFor = (net: number, percent?: number | null): number =>
  Math.round((Number(net) || 0) * (Number(percent) || 0)) / 100;
