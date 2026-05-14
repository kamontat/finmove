import type { Expense, Trip } from "../../models";

export interface CurrencyReferences {
	expenses: Expense[];
}

export function findCurrencyReferences(
	trip: Trip,
	code: string,
): CurrencyReferences {
	return { expenses: trip.expenses.filter((e) => e.currency === code) };
}
