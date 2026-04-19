import type { Account, Expense, ExpenseOwnerSplit, Owner } from "../models";

function isExpenseOwnerSplitArray(
  owners: string[] | ExpenseOwnerSplit[],
): owners is ExpenseOwnerSplit[] {
  return owners.length > 0 && typeof owners[0] === "object";
}

function parsePercentage(value: string | number): number | null {
  if (typeof value === "number") return null; // not a percentage
  const match = value.match(/^(\d+(?:\.\d+)?)%$/);
  if (match?.[1]) return parseFloat(match[1]);
  return null;
}

export function validateExpenses(
  expenses: Expense[],
  accounts: Account[],
  owners: Owner[],
): string[] {
  const errors: string[] = [];
  const accountIds = new Set(accounts.map((a) => a.id));
  const ownerIds = new Set(owners.map((o) => o.id));
  const seenIds = new Set<string>();

  for (const expense of expenses) {
    if (seenIds.has(expense.id)) {
      errors.push(`Duplicate expense ID found: "${expense.id}".`);
    } else {
      seenIds.add(expense.id);
    }

    if (!accountIds.has(expense.accountId)) {
      errors.push(
        `Expense "${expense.id}" references non-existent account ID: "${expense.accountId}".`,
      );
    }

    if (expense.owners && expense.owners.length > 0) {
      if (isExpenseOwnerSplitArray(expense.owners)) {
        let percentageTotal = 0;
        let hasPercentages = false;

        for (const ownerSplit of expense.owners) {
          if (!ownerIds.has(ownerSplit.id)) {
            errors.push(
              `Expense "${expense.id}" references non-existent owner ID: "${ownerSplit.id}".`,
            );
          }

          if (ownerSplit.split != null) {
            const pct = parsePercentage(ownerSplit.split);
            if (pct !== null) {
              hasPercentages = true;
              percentageTotal += pct;
            }
          }
        }

        if (hasPercentages && Math.abs(percentageTotal - 100) > 0.001) {
          errors.push(
            `Expense "${expense.id}" percentage splits total ${percentageTotal}%, but must total 100%.`,
          );
        }
      } else {
        for (const ownerId of expense.owners as string[]) {
          if (!ownerIds.has(ownerId)) {
            errors.push(
              `Expense "${expense.id}" references non-existent owner ID: "${ownerId}".`,
            );
          }
        }
      }
    }
  }

  return errors;
}
