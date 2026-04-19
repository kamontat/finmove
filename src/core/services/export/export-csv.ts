import type { Trip } from "../../models";
import { convertToTHB } from "../currency/convert-to-thb";
import { calculateSplits } from "../expense/calculate-splits";

const HEADERS = [
	"Account",
	"Owner",
	"Date",
	"Payee",
	"Category",
	"Amount",
	"Description",
	"Tags",
];

function quoteField(value: string): string {
	return `"${value.replace(/"/g, '""')}"`;
}

function formatRow(fields: string[]): string {
	return fields.map(quoteField).join(",");
}

export function exportCSV(trip: Trip): string {
	const lines: string[] = [formatRow(HEADERS)];

	for (const expense of trip.expenses) {
		const account = trip.accounts.find((a) => a.id === expense.accountId);
		if (!account) continue;

		const tripRate = trip.settings.currencies[expense.currency]?.exchangeRate;
		const thbTotal = convertToTHB(
			expense.amount,
			expense.currency,
			expense.exchangeRate,
			tripRate,
		);

		const splits = calculateSplits(thbTotal, expense.owners, trip.owners);

		for (const split of splits) {
			const owner = trip.owners.find((o) => o.id === split.ownerId);
			if (!owner) continue;

			const amount = split.amount.toFixed(2);
			const tags = expense.tags.join(";");

			lines.push(
				formatRow([
					account.name,
					owner.name,
					expense.date,
					expense.payee,
					expense.category,
					amount,
					expense.description,
					tags,
				]),
			);
		}
	}

	return `${lines.join("\n")}\n`;
}
