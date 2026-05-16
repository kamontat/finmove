import type { Expense, Trip } from "../../models";
import { convertToTHB } from "../currency";
import { computeInitials } from "../owner";

export type SortKey = "date" | "thb" | "account" | "owner" | "category";
export type SortDir = "asc" | "desc";
export type SortLevel = { key: SortKey; dir: SortDir };

function firstOwnerInitial(
	expense: Expense,
	trip: Trip,
	initialsMap: Record<string, string>,
): string {
	if (!expense.owners || expense.owners.length === 0) return "";
	const first = expense.owners[0];
	if (first === undefined) return "";
	const id = typeof first === "string" ? first : first.id;
	const owner = trip.owners.find((o) => o.id === id);
	if (!owner) return id.toLowerCase();
	return (initialsMap[owner.name] ?? owner.name).toLowerCase();
}

function thbValue(expense: Expense, trip: Trip): number | null {
	if (expense.currency === "THB") return expense.amount;
	const tripRate = trip.settings.currencies[expense.currency]?.exchangeRate;
	const rate = expense.exchangeRate ?? tripRate;
	if (rate === undefined) return null;
	return convertToTHB(
		expense.amount,
		expense.currency,
		expense.exchangeRate,
		tripRate,
	);
}

function accountName(expense: Expense, trip: Trip): string {
	const account = trip.accounts.find((a) => a.id === expense.accountId);
	return (account?.name ?? expense.accountId).toLowerCase();
}

function compareLevel(
	a: Expense,
	b: Expense,
	level: SortLevel,
	trip: Trip,
	initialsMap: Record<string, string>,
): number {
	const sign = level.dir === "asc" ? 1 : -1;
	switch (level.key) {
		case "date":
			return sign * a.date.localeCompare(b.date);
		case "thb": {
			const av = thbValue(a, trip);
			const bv = thbValue(b, trip);
			if (av === null && bv === null) return 0;
			if (av === null) return 1;
			if (bv === null) return -1;
			return sign * (av - bv);
		}
		case "account":
			return sign * accountName(a, trip).localeCompare(accountName(b, trip));
		case "category":
			return (
				sign * a.category.toLowerCase().localeCompare(b.category.toLowerCase())
			);
		case "owner": {
			const aCount = a.owners?.length ?? 0;
			const bCount = b.owners?.length ?? 0;
			if (aCount !== bCount) return sign * (aCount - bCount);
			const aInit = firstOwnerInitial(a, trip, initialsMap);
			const bInit = firstOwnerInitial(b, trip, initialsMap);
			return sign * aInit.localeCompare(bInit);
		}
	}
}

export function sortExpenses(
	expenses: Expense[],
	trip: Trip,
	levels: SortLevel[],
): Expense[] {
	const initialsMap = computeInitials(trip.owners.map((o) => o.name));
	const decorated = expenses.map((e, i) => ({ e, i }));
	decorated.sort((x, y) => {
		for (const level of levels) {
			const c = compareLevel(x.e, y.e, level, trip, initialsMap);
			if (c !== 0) return c;
		}
		return x.i - y.i;
	});
	return decorated.map((d) => d.e);
}
