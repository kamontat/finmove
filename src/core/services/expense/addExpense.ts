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

	if (expense.owners && expense.owners.length > 0) {
		for (const ref of expense.owners) {
			const ownerId = typeof ref === "string" ? ref : ref.id;
			if (!trip.owners.some((o) => o.id === ownerId)) {
				throw new Error(`Owner "${ownerId}" not found`);
			}
		}
	}

	const merged: string[] = [...trip.settings.tags];
	for (const tag of expense.tags) {
		if (!merged.includes(tag)) merged.push(tag);
	}
	const expenseToWrite: Expense = { ...expense, tags: merged };

	const filePath = join(trip.dirPath, "expenses.yaml");
	const data = parse(readFileSync(filePath, "utf-8")) ?? { expenses: [] };
	data.expenses.push(expenseToWrite);
	writeFileSync(filePath, stringify(data));
	trip.expenses.push(expenseToWrite);
}
