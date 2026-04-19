import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { Expense, Trip } from "../../models";

export function addExpense(trip: Trip, expense: Expense): void {
	const existing = trip.expenses.find((e) => e.id === expense.id);
	if (existing) {
		throw new Error(`Expense with id "${expense.id}" already exists`);
	}

	if (!trip.accounts.some((a) => a.id === expense.accountId)) {
		throw new Error(`Account "${expense.accountId}" not found`);
	}

	const filePath = join(trip.dirPath, "expenses.yaml");
	const data = parse(readFileSync(filePath, "utf-8")) ?? { expenses: [] };
	data.expenses.push(expense);
	writeFileSync(filePath, stringify(data));
	trip.expenses.push(expense);
}
