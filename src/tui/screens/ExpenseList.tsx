import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { TableSelect } from "../components/molecules/TableSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function ExpenseList(): JSX.Element {
	const { trip } = useData();
	const { focus, setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("expense-");
	}, [clearByPrefix]);

	useEffect(() => {
		if (!trip) return;
		setFocus(trip.expenses.length > 0 ? "main" : "menu");
	}, [trip, setFocus]);

	useEffect(() => {
		setTitleSuffix(null);
		setBorderColor(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasExpenses = trip.expenses.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasExpenses
					? [
							{ label: "Duplicate", value: "duplicate", key: "d" },
							{ label: "Delete", value: "delete", key: "x" },
						]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/expenses/form", { props: { tripDirPath } });
				} else if (value === "duplicate" && hasExpenses) {
					goTo("/trips/expenses/duplicate", { props: { tripDirPath } });
				} else if (value === "delete" && hasExpenses) {
					goTo("/trips/expenses/delete", { props: { tripDirPath } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [trip, setMenu, setHints, setBorderColor, setTitleSuffix, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const headers = ["Date", "Account", "Payee", "Category", "Amount", "Tags"];
	const rows = trip.expenses.map((e) => {
		const account = trip.accounts.find((a) => a.id === e.accountId);
		return [
			{ text: e.date },
			{ text: account?.name ?? e.accountId },
			{ text: e.payee },
			{ text: e.category },
			{ text: `${e.amount} ${e.currency}` },
			{ text: e.tags.length > 0 ? String(e.tags.length) : "" },
		];
	});

	if (trip.expenses.length === 0) {
		return <Text dimColor>No expenses yet.</Text>;
	}

	return (
		<TableSelect
			headers={headers}
			rows={rows}
			onChange={(rowIndex) => {
				const expense = trip.expenses[rowIndex];
				if (!expense) return;
				goTo("/trips/expenses/form", {
					props: { tripDirPath: trip.dirPath, expenseId: expense.id },
				});
			}}
			isActive={focus === "main"}
		/>
	);
}
