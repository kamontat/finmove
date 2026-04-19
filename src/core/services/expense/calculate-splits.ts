import type { ExpenseOwnerSplit, Owner } from "../../models";

export interface OwnerAmount {
  ownerId: string;
  amount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isStringArray(arr: unknown[]): arr is string[] {
  return typeof arr[0] === "string";
}

export function calculateSplits(
  totalAmount: number,
  owners: string[] | ExpenseOwnerSplit[] | undefined,
  allTripOwners: Owner[]
): OwnerAmount[] {
  // Case 1: omitted — equal split among all trip owners
  if (owners === undefined || owners.length === 0) {
    const share = round2(totalAmount / allTripOwners.length);
    return allTripOwners.map((o) => ({ ownerId: o.id, amount: share }));
  }

  // Case 2: list of string IDs — equal split among listed
  if (isStringArray(owners)) {
    const share = round2(totalAmount / owners.length);
    return owners.map((id) => ({ ownerId: id, amount: share }));
  }

  // Case 3: list of ExpenseOwnerSplit objects
  const firstWithSplit = owners.find((o) => o.split !== undefined);

  // No split fields — equal split among listed
  if (firstWithSplit === undefined) {
    const share = round2(totalAmount / owners.length);
    return owners.map((o) => ({ ownerId: o.id, amount: share }));
  }

  // Percentage split
  if (typeof firstWithSplit.split === "string" && firstWithSplit.split.endsWith("%")) {
    return owners.map((o) => {
      const pct = Number.parseFloat((o.split as string).replace("%", "")) / 100;
      return { ownerId: o.id, amount: round2(totalAmount * pct) };
    });
  }

  // Fixed amount split
  return owners.map((o) => ({
    ownerId: o.id,
    amount: round2(o.split as number),
  }));
}
