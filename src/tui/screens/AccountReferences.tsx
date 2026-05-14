import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useMemo, useRef } from "react";
import {
	findAccountReferences,
	removeAccount,
} from "../../core/services/account";
import { ListSelect } from "../components/molecules/ListSelect";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function AccountReferences(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack } = useNavigation();

	const { tripDirPath, accountId } = useRouteProps(
		"/trips/accounts/references",
	);

	const refs = useMemo(() => {
		if (!trip) return { expenses: [] };
		return findAccountReferences(trip, accountId);
	}, [trip, accountId]);

	const isEmpty = refs.expenses.length === 0;

	const deletedRef = useRef(false);
	useEffect(() => {
		if (!trip) return;
		if (deletedRef.current) return;
		if (!isEmpty) return;
		deletedRef.current = true;
		removeAccount(trip, accountId);
		reloadTrip();
		goBack();
	}, [trip, accountId, isEmpty, reloadTrip, goBack]);

	const account = trip?.accounts.find((a) => a.id === accountId);

	useEffect(() => {
		setBorderColor("red");
		setMenu([], () => {});
		setHints([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Edit" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
		setTitleSuffix(
			account ? `References: ${account.name}` : `References: ${accountId}`,
		);
		return () => {
			setBorderColor(null);
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix, account, accountId]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (isEmpty) {
		return <Text dimColor>Removing...</Text>;
	}

	return (
		<Box flexDirection="column">
			<Text color="red" bold>
				Cannot delete account — clear the expenses below first:
			</Text>
			<ListSelect
				options={refs.expenses.map((e) => ({
					label: `${e.date} ${e.payee}`,
					value: e.id,
					detail: `(${e.amount} ${e.currency})`,
				}))}
				onChange={(expenseId) => {
					goTo("/trips/expenses/form", {
						props: { tripDirPath, expenseId },
					});
				}}
				isActive={focus === "main"}
			/>
		</Box>
	);
}
