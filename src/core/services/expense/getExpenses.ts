import type { Expense, Trip } from "../../models";

export function getExpenses(trip: Trip): Expense[] {
	return trip.expenses;
}
