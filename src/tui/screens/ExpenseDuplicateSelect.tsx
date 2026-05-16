import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { TableSelect } from "../components/molecules/TableSelect";
import { SELECT_DUPLICATE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { tripTitle } from "../utils/titles";
import { buildExpenseListRows, EXPENSE_LIST_HEADERS } from "./ExpenseList";

export function ExpenseDuplicateSelect(): JSX.Element {
	const { trip } = useData();
	const { focus } = useFocus();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();
	const { goTo } = useNavigation();

	useEffect(() => {
		setColor({ border: "yellow", title: "yellow" });
		setMenu([], () => {});
		setHints(SELECT_DUPLICATE_HINTS);
		setTitle(tripTitle(trip, "Expenses", "Duplicate"));
		return () => {
			setColor({});
			clearTitle();
		};
	}, [setColor, setMenu, setHints, setTitle, clearTitle, trip]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.expenses.length === 0) {
		return <Text dimColor>No expenses.</Text>;
	}

	const headers = EXPENSE_LIST_HEADERS;
	const rows = buildExpenseListRows(trip, trip.expenses);

	return (
		<TableSelect
			headers={headers}
			rows={rows}
			onChange={(rowIndex) => {
				const expense = trip.expenses[rowIndex];
				if (!expense) return;
				goTo("/trips/expenses/form", {
					replace: true,
					props: {
						tripDirPath: trip.dirPath,
						duplicateFromId: expense.id,
					},
				});
			}}
			isActive={focus === "main"}
		/>
	);
}
