import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Expense, Trip } from "../../models";

export function updateExpense(trip: Trip, expense: Expense): void {
	const index = trip.expenses.findIndex((e) => e.id === expense.id);
	if (index === -1) {
		throw new Error(`Expense with id "${expense.id}" not found`);
	}

	if (!trip.accounts.some((a) => a.id === expense.accountId)) {
		throw new Error(`Account "${expense.accountId}" not found`);
	}

	const filePath = join(trip.dirPath, "expenses.yaml");
	const data = parse(readFileSync(filePath, "utf-8")) ?? { expenses: [] };
	data.expenses[index] = expense;
	writeFileSync(filePath, stringify(data));
	trip.expenses[index] = expense;
}
