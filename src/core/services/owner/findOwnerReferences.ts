import type { Account, Expense, Trip } from "../../models";

export interface OwnerReferences {
	accounts: Account[];
	expenses: Expense[];
}

export function findOwnerReferences(
	trip: Trip,
	ownerId: string,
): OwnerReferences {
	const accounts = trip.accounts.filter((a) => a.owners.includes(ownerId));
	const expenses = trip.expenses.filter((e) => {
		if (!e.owners) return false;
		return e.owners.some((o) =>
			typeof o === "string" ? o === ownerId : o.id === ownerId,
		);
	});
	return { accounts, expenses };
}
