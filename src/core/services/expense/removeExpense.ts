import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Trip } from "../../models";

export function removeExpense(trip: Trip, expenseId: string): void {
	const index = trip.expenses.findIndex((e) => e.id === expenseId);
	if (index === -1) {
		throw new Error(`Expense with id "${expenseId}" not found`);
	}

	const filePath = join(trip.dirPath, "expenses.yaml");
	const data = parse(readFileSync(filePath, "utf-8"));
	data.expenses.splice(index, 1);
	writeFileSync(filePath, stringify(data));
	trip.expenses.splice(index, 1);
}
