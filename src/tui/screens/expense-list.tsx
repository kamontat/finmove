import { Box } from "ink";
import type { JSX } from "react";
import type { Trip } from "../../core/models";
import { TextLabel } from "../components/atoms/text-label";
import { DataTable } from "../components/organisms/data-table";
import { NavigationMenu } from "../components/organisms/navigation-menu";

interface ExpenseListProps {
	trip: Trip;
	onAddExpense: () => void;
	onEditExpense: (expenseId: string) => void;
}

export function ExpenseList({
	trip,
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
		{ label: "Add", value: "add", key: "a" },
		...trip.expenses.map((e, i) => ({
			label: `${e.payee}`,
			value: `edit:${e.id}`,
			key: String(i + 1),
		})),
	];

	return (
		<Box flexDirection="column" gap={1}>
			<TextLabel text="Expenses" bold color="cyan" />
			{rows.length > 0 && (
				<DataTable
					headers={["#", "Date", "Account", "Payee", "Category", "Amount"]}
					rows={rows.map((r, i) => [String(i + 1), ...r])}
				/>
			)}
			{rows.length === 0 && <TextLabel text="No expenses yet." dimColor />}
			<NavigationMenu
				options={menuOptions}
				onSelect={(value) => {
					if (value === "add") return onAddExpense();
					if (value.startsWith("edit:"))
						return onEditExpense(value.replace("edit:", ""));
				}}
			/>
		</Box>
	);
}
