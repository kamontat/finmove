import { Text } from "ink";
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
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";
import { useNotification } from "../states/notification";
import { tripTitle } from "../utils/titles";

export function AccountReferences(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus } = useFocus();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();
	const { goTo, goBack } = useNavigation();
	const { notify } = useNotification();

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

	const notifiedRef = useRef(false);
	useEffect(() => {
		if (!trip) return;
		if (isEmpty) return;
		if (notifiedRef.current) return;
		notifiedRef.current = true;
		notify(
			`Cannot delete account "${account?.name ?? accountId}" — clear the expenses below first`,
			"error",
		);
	}, [trip, isEmpty, notify, account, accountId]);

	useEffect(() => {
		setColor({ border: "red", title: "red" });
		setMenu([], () => {});
		setHints([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Edit" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
		setTitle(
			tripTitle(trip, "Accounts", "References", account?.name ?? accountId),
		);
		return () => {
			setColor({});
			clearTitle();
		};
	}, [
		setColor,
		setMenu,
		setHints,
		setTitle,
		clearTitle,
		trip,
		account,
		accountId,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (isEmpty) {
		return <Text dimColor>Removing...</Text>;
	}

	return (
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
	);
}
