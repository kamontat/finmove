import type { Trip } from "../../models";

export function nextExpenseId(trip: Trip, date: string): string {
	const datePart = date.replaceAll("-", "");
	const prefix = `exp-${datePart}-id`;
	const max = trip.expenses
		.map((e) => e.id)
		.filter((id) => id.startsWith(prefix))
		.map((id) => Number.parseInt(id.slice(prefix.length), 10))
		.filter((n) => !Number.isNaN(n))
		.reduce((acc, n) => Math.max(acc, n), -1);
	return `${prefix}${max + 1}`;
}
