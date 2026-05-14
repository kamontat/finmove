import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { removeExpense } from "../../core/services/expense";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function ExpenseDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setColor, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setColor({ border: "red", title: "red" });
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix(null);
		return () => {
			setColor({});
			setTitleSuffix(null);
		};
	}, [setColor, setMenu, setHints, setTitleSuffix]);

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
