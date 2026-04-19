export function convertToTHB(
  amount: number,
  currency: string,
  expenseRate?: number,
  tripRate?: number
): number {
  if (currency === "THB") {
    return amount;
  }

  const rate = expenseRate ?? tripRate;
  if (rate === undefined) {
    throw new Error(`No exchange rate available for ${currency}`);
  }

  return Math.round(amount * rate * 100) / 100;
}
