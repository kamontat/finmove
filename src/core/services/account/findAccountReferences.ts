import type { Expense, Trip } from "../../models";

export interface AccountReferences {
	expenses: Expense[];
}

export function findAccountReferences(
	trip: Trip,
	accountId: string,
): AccountReferences {
	return {
		expenses: trip.expenses.filter((e) => e.accountId === accountId),
	};
}
