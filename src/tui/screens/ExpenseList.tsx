import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { DataTable } from "../components/organisms/DataTable";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function ExpenseList(): JSX.Element {
	const { trip } = useData();
	const { goTo } = useNavigation();
	const { setMenu, setHints } = useLayout();
	useEffect(() => {
		if (!trip) return;

		const tripDirPath = trip.dirPath;

		const menuOptions = [
			{ label: "Add", value: "add", key: "a" },
			...trip.expenses.map((e) => ({
				label: `Edit: ${e.payee}`,
				value: `edit:${e.id}`,
			})),
		];

		setMenu(menuOptions, (value) => {
			if (value === "add") {
				goTo("/trips/expenses/form", { props: { tripDirPath } });
			} else if (value.startsWith("edit:")) {
				const expenseId = value.replace("edit:", "");
				goTo("/trips/expenses/form", { props: { tripDirPath, expenseId } });
			}
		});
		setHints([
			{ key: "tab", label: "Switch focus" },
			{ key: "←→", label: "Navigate menu" },
			{ key: "Enter", label: "Confirm" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
	}, [trip, setMenu, setHints, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.expenses.length === 0) {
		return <Text dimColor>No expenses yet.</Text>;
	}

	const rows = trip.expenses.map((e, i) => {
		const account = trip.accounts.find((a) => a.id === e.accountId);
		return [
			String(i + 1),
			e.date,
			account?.name ?? e.accountId,
			e.payee,
			e.category,
			`${e.amount} ${e.currency}`,
		];
	});

	return (
		<DataTable
			headers={["#", "Date", "Account", "Payee", "Category", "Amount"]}
			rows={rows}
		/>
	);
}
