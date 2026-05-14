import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { TableSelect } from "../components/molecules/TableSelect";
import { LIST_HINTS, SELECT_DUPLICATE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function ExpenseList(): JSX.Element {
	const { trip } = useData();
	const { focus, setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();

	const { selectMode } = useRouteProps("/trips/expenses");

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("expense-");
	}, [clearByPrefix]);

	useEffect(() => {
		if (!trip || selectMode) return;
		setFocus(trip.expenses.length > 0 ? "main" : "menu");
	}, [trip, selectMode, setFocus]);

	useEffect(() => {
		setTitleSuffix(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasExpenses = trip.expenses.length > 0;

		if (selectMode === "duplicate") {
			setBorderColor(null);
			setMenu([], () => {});
			setHints(SELECT_DUPLICATE_HINTS);
			return;
		}

		setBorderColor(null);
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
					goTo("/trips/expenses", {
						props: { tripDirPath, selectMode: "duplicate" },
					});
				} else if (value === "delete" && hasExpenses) {
					goTo("/trips/expenses/delete", { props: { tripDirPath } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		trip,
		selectMode,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const headers = ["Date", "Account", "Payee", "Category", "Amount", "Tags"];
	const rows = trip.expenses.map((e) => {
		const account = trip.accounts.find((a) => a.id === e.accountId);
		return [
			e.date,
			account?.name ?? e.accountId,
			e.payee,
			e.category,
			`${e.amount} ${e.currency}`,
			e.tags.length > 0 ? String(e.tags.length) : "",
		];
	});

	if (selectMode === "duplicate") {
		if (trip.expenses.length === 0) {
			return <Text dimColor>No expenses.</Text>;
		}

		return (
			<Box flexDirection="column">
				<Text bold color="cyan">
					Select an expense to duplicate:
				</Text>
				<TableSelect
					headers={headers}
					rows={rows}
					onChange={(rowIndex) => {
						const expense = trip.expenses[rowIndex];
						if (!expense) return;
						goTo("/trips/expenses/form", {
							props: {
								tripDirPath: trip.dirPath,
								duplicateFromId: expense.id,
							},
						});
					}}
					isActive={focus === "main"}
				/>
			</Box>
		);
	}

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
