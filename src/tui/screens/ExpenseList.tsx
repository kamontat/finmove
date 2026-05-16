import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import type { Expense, Trip } from "../../core/models";
import { convertToTHB } from "../../core/services/currency";
import {
	removeExpense,
	type SortKey,
	type SortLevel,
	sortExpenses,
} from "../../core/services/expense";
import { computeInitials } from "../../core/services/owner";
import type { TableCell } from "../components/molecules/TableSelect";
import { TableSelect } from "../components/molecules/TableSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { activeSlots, useExpenseListSort } from "../states/expenseListSort";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { tripTitle } from "../utils/titles";

export const EXPENSE_LIST_HEADERS: string[] = [
	"Account",
	"Date",
	"Payee",
	"Category",
	"Amount",
	"Rate",
	"THB",
	"Owner",
	"#Tags",
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

export function buildExpenseListRows(
	trip: Trip,
	expenses: Expense[],
): TableCell[][] {
	const initialsMap = computeInitials(trip.owners.map((o) => o.name));

	// First pass: compute raw numeric strings per row for the Amount and THB columns.
	const numericData = expenses.map((e) => {
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

	return expenses.map((e, i) => {
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
			rateCell = { text: data.rate.toFixed(3) };
		} else {
			rateCell = { text: "?", color: "red" };
		}

		const thbCell: TableCell = data.thbMissing
			? { text: "?".padStart(thbWidth), color: "red" }
			: { text: `${data.thbNum.padStart(thbWidth)} THB` };

		return [
			{ text: account?.name ?? e.accountId },
			{ text: e.date },
			{ text: e.payee },
			{ text: e.category },
			amountCell,
			rateCell,
			thbCell,
			formatOwnersCell(e, trip, initialsMap),
			{ text: e.tags.length > 0 ? String(e.tags.length) : "" },
		];
	});
}

const SORT_KEY_TO_HEADER: Record<SortKey, string> = {
	date: "Date",
	thb: "THB",
	account: "Account",
	owner: "Owner",
	category: "Category",
};

const PRIORITY_SUBSCRIPTS = ["₁", "₂", "₃", "₄", "₅"] as const;

export function buildSortedHeaders(
	headers: string[],
	levels: SortLevel[],
): string[] {
	if (levels.length === 0) return headers;
	return headers.map((h) => {
		const idx = levels.findIndex((l) => SORT_KEY_TO_HEADER[l.key] === h);
		if (idx === -1) return h;
		const arrow = levels[idx]?.dir === "desc" ? "↓" : "↑";
		const subscript = levels.length > 1 ? (PRIORITY_SUBSCRIPTS[idx] ?? "") : "";
		return `${h}${arrow}${subscript}`;
	});
}

export function ExpenseList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus, setFocus } = useFocus();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu, armed, setActiveIndex } = useMenu();
	const { goTo, goBack } = useNavigation();
	const { slots } = useExpenseListSort();

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("expense-");
	}, [clearByPrefix]);

	useEffect(() => {
		if (!trip) return;
		setFocus(trip.expenses.length > 0 ? "main" : "menu");
	}, [trip, setFocus]);

	useEffect(() => {
		setTitle(tripTitle(trip, "Expenses"));
		return () => clearTitle();
	}, [setTitle, clearTitle, trip]);

	useEffect(() => {
		setColor({});
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasExpenses = trip.expenses.length > 0;
		const levels = activeSlots(slots);
		const sortedExpenses = sortExpenses(trip.expenses, trip, levels);

		setMenu(
			[
				{ label: "Sort", value: "sort", key: "s" },
				{ label: "Add", value: "add", key: "a" },
				...(hasExpenses
					? [
							{
								label: "Duplicate",
								value: "duplicate",
								key: "d",
								mainAction: {
									onConfirm: (i: number) => {
										const e = sortedExpenses[i];
										if (!e) return;
										goTo("/trips/expenses/form", {
											props: { tripDirPath, duplicateFromId: e.id },
										});
									},
								},
							},
							{
								label: "Delete",
								value: "delete",
								key: "x",
								mainAction: {
									confirmCount: 2,
									onConfirm: (i: number) => {
										const e = sortedExpenses[i];
										if (!e) return;
										removeExpense(trip, e.id);
										reloadTrip();
										if (trip.expenses.length === 0) {
											goBack();
										}
									},
								},
							},
						]
					: []),
			],
			(value) => {
				if (value === "sort") {
					goTo("/trips/expenses/sort", { props: { tripDirPath } });
				} else if (value === "add") {
					goTo("/trips/expenses/form", { props: { tripDirPath } });
				} else if (value === "duplicate" && hasExpenses) {
					goTo("/trips/expenses/duplicate", { props: { tripDirPath } });
				} else if (value === "delete" && hasExpenses) {
					goTo("/trips/expenses/delete", { props: { tripDirPath } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [trip, reloadTrip, setMenu, setHints, setColor, goTo, goBack, slots]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.expenses.length === 0) {
		return <Text dimColor>No expenses yet.</Text>;
	}

	const levels = activeSlots(slots);
	const sortedExpenses = sortExpenses(trip.expenses, trip, levels);
	const headers = buildSortedHeaders(EXPENSE_LIST_HEADERS, levels);
	const rows = buildExpenseListRows(trip, sortedExpenses);

	return (
		<TableSelect
			headers={headers}
			rows={rows}
			onChange={(rowIndex) => {
				const expense = sortedExpenses[rowIndex];
				if (!expense) return;
				goTo("/trips/expenses/form", {
					props: { tripDirPath: trip.dirPath, expenseId: expense.id },
				});
			}}
			onHighlight={setActiveIndex}
			armedRowIndex={armed?.index ?? null}
			isActive={focus === "main"}
		/>
	);
}
