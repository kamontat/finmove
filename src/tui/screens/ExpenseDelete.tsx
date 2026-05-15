import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { removeExpense } from "../../core/services/expense";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { tripTitle } from "../utils/titles";

export function ExpenseDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();
	const { goBack } = useNavigation();

	useEffect(() => {
		setColor({ border: "red", title: "red" });
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitle(tripTitle(trip, "Expenses", "Delete"));
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

	return (
		<RemoveSelector
			options={trip.expenses.map((e) => ({
				label: e.payee,
				value: e.id,
				detail: `(${e.date} · ${e.amount} ${e.currency})`,
			}))}
			onConfirm={(value) => {
				removeExpense(trip, value);
				reloadTrip();
				if (trip.expenses.length === 0) {
					goBack();
				}
			}}
		/>
	);
}
