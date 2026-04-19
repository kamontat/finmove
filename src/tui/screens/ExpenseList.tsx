import { Text } from "ink";
import type { JSX } from "react";
import type { Trip } from "../../core/models";
import { DataTable } from "../components/organisms/DataTable";

interface ExpenseListProps {
	trip: Trip;
}

export function ExpenseList({ trip }: ExpenseListProps): JSX.Element {
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
