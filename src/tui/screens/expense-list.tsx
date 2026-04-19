import { Box } from "ink";
import type { JSX } from "react";
import type { Trip } from "../../core/models";
import { removeExpense } from "../../core/services/expense";
import { TextLabel } from "../components/atoms/text-label";
import { DataTable } from "../components/organisms/data-table";
import { NavigationMenu } from "../components/organisms/navigation-menu";

interface ExpenseListProps {
	trip: Trip;
	onBack: () => void;
	onTripUpdated: () => void;
	onAddExpense: () => void;
	onEditExpense: (expenseId: string) => void;
}

export function ExpenseList({
	trip,
	onBack,
	onTripUpdated,
	onAddExpense,
	onEditExpense,
}: ExpenseListProps): JSX.Element {
	const rows = trip.expenses.map((e) => {
		const account = trip.accounts.find((a) => a.id === e.accountId);
		return [
			e.date,
			account?.name ?? e.accountId,
			e.payee,
			e.category,
			`${e.amount} ${e.currency}`,
		];
	});

	const menuOptions = [
		{ label: "Add expense", value: "add" },
		...trip.expenses.map((e) => ({
			label: `Edit: ${e.date} ${e.payee} (${e.amount} ${e.currency})`,
			value: `edit:${e.id}`,
		})),
		...trip.expenses.map((e) => ({
			label: `Delete: ${e.date} ${e.payee}`,
			value: `delete:${e.id}`,
		})),
		{ label: "Back", value: "__back__" },
	];

	return (
		<Box flexDirection="column" gap={1}>
			<TextLabel text="Expenses" bold color="cyan" />
			{rows.length > 0 && (
				<DataTable
					headers={["Date", "Account", "Payee", "Category", "Amount"]}
					rows={rows}
				/>
			)}
			{rows.length === 0 && <TextLabel text="No expenses yet." dimColor />}
			<NavigationMenu
				title="Actions"
				options={menuOptions}
				onSelect={(value) => {
					if (value === "__back__") return onBack();
					if (value === "add") return onAddExpense();
					if (value.startsWith("edit:"))
						return onEditExpense(value.replace("edit:", ""));
					if (value.startsWith("delete:")) {
						removeExpense(trip, value.replace("delete:", ""));
						onTripUpdated();
					}
				}}
			/>
		</Box>
	);
}
