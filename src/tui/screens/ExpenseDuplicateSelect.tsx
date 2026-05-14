import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { TableSelect } from "../components/molecules/TableSelect";
import { SELECT_DUPLICATE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function ExpenseDuplicateSelect(): JSX.Element {
	const { trip } = useData();
	const { focus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();

	useEffect(() => {
		setBorderColor(null);
		setMenu([], () => {});
		setHints(SELECT_DUPLICATE_HINTS);
		setTitleSuffix(null);
		return () => {
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.expenses.length === 0) {
		return <Text dimColor>No expenses.</Text>;
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
