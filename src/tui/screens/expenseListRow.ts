import type { Expense, Trip } from "../../core/models";
import { convertToTHB } from "../../core/services/currency";
import { computeInitials } from "../../core/services/owner";
import type { TableCell } from "../components/molecules/TableSelect";

export const EXPENSE_LIST_HEADERS: string[] = [
	"Date",
	"Account",
	"Owners",
	"Payee",
	"Category",
	"Amount",
	"Rate",
	"THB",
	"Tags",
];

function formatFinanceNumber(n: number): string {
	return n.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

function formatOwnersCell(
	expense: Expense,
	trip: Trip,
	initialsMap: Record<string, string>,
): TableCell {
	if (!expense.owners || expense.owners.length === 0) {
		return { text: "" };
	}
	// for...of over `(string[] | ExpenseOwnerSplit[])` gives a `string | ExpenseOwnerSplit`
	// element type that narrows cleanly with `typeof`. Using `.map` on the union
	// confuses TypeScript because it resolves to a union of two map signatures.
	const parts: string[] = [];
	for (const entry of expense.owners) {
		const id = typeof entry === "string" ? entry : entry.id;
		const owner = trip.owners.find((o) => o.id === id);
		parts.push(owner ? (initialsMap[owner.name] ?? owner.name) : id);
	}
	return { text: parts.join(", ") };
}

export function buildExpenseListRows(trip: Trip): TableCell[][] {
	const initialsMap = computeInitials(trip.owners.map((o) => o.name));

	// First pass: compute raw numeric strings per row for the Amount and THB columns.
	const numericData = trip.expenses.map((e) => {
		const amountNum = formatFinanceNumber(e.amount);

		const tripRate = trip.settings.currencies[e.currency]?.exchangeRate;
		const rate = e.exchangeRate ?? tripRate ?? null;

		let thbNum: string;
		let thbMissing = false;
		if (e.currency === "THB") {
			thbNum = formatFinanceNumber(e.amount);
		} else if (rate !== null) {
			thbNum = formatFinanceNumber(
				convertToTHB(e.amount, e.currency, e.exchangeRate, tripRate),
			);
		} else {
			thbNum = "?";
			thbMissing = true;
		}

		return { amountNum, thbNum, thbMissing, rate };
	});

	const amountWidth = numericData.reduce(
		(max, d) => Math.max(max, d.amountNum.length),
		0,
	);
	const thbWidth = numericData.reduce(
		(max, d) => Math.max(max, d.thbNum.length),
		0,
	);

	return trip.expenses.map((e, i) => {
		const account = trip.accounts.find((a) => a.id === e.accountId);
		const data = numericData[i];
		if (!data) throw new Error("invariant: numericData index missing");

		const amountCell: TableCell = {
			text: `${data.amountNum.padStart(amountWidth)} ${e.currency}`,
		};

		let rateCell: TableCell;
		if (e.currency === "THB") {
			rateCell = { text: "" };
		} else if (data.rate !== null) {
			rateCell = { text: data.rate.toFixed(2) };
		} else {
			rateCell = { text: "?", color: "red" };
		}

		const thbCell: TableCell = data.thbMissing
			? { text: "?".padStart(thbWidth), color: "red" }
			: { text: `${data.thbNum.padStart(thbWidth)} THB` };

		return [
			{ text: e.date },
			{ text: account?.name ?? e.accountId },
			formatOwnersCell(e, trip, initialsMap),
			{ text: e.payee },
			{ text: e.category },
			amountCell,
			rateCell,
			thbCell,
			{ text: e.tags.length > 0 ? String(e.tags.length) : "" },
		];
	});
}
