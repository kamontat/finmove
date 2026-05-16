import { Box, Text, useInput } from "ink";
import type { JSX } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { findOwnerReferences, removeOwner } from "../../core/services/owner";
import { ListSelect } from "../components/molecules/ListSelect";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";
import { useNotification } from "../states/notification";
import { tripTitle } from "../utils/titles";

export function OwnerReferences(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus } = useFocus();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();
	const { goTo, goBack } = useNavigation();
	const { notify } = useNotification();

	const { tripDirPath, ownerId } = useRouteProps("/trips/owners/references");

	const refs = useMemo(() => {
		if (!trip) return { accounts: [], expenses: [] };
		return findOwnerReferences(trip, ownerId);
	}, [trip, ownerId]);

	const hasAccounts = refs.accounts.length > 0;
	const hasExpenses = refs.expenses.length > 0;
	const isEmpty = !hasAccounts && !hasExpenses;

	const [activeTab, setActiveTab] = useState<"accounts" | "expenses">(
		hasAccounts ? "accounts" : "expenses",
	);

	useEffect(() => {
		if (activeTab === "accounts" && !hasAccounts && hasExpenses) {
			setActiveTab("expenses");
		} else if (activeTab === "expenses" && !hasExpenses && hasAccounts) {
			setActiveTab("accounts");
		}
	}, [activeTab, hasAccounts, hasExpenses]);

	const deletedRef = useRef(false);
	useEffect(() => {
		if (!trip) return;
		if (deletedRef.current) return;
		if (!isEmpty) return;
		deletedRef.current = true;
		removeOwner(trip, ownerId);
		reloadTrip();
		goBack();
	}, [trip, ownerId, isEmpty, reloadTrip, goBack]);

	const owner = trip?.owners.find((o) => o.id === ownerId);

	const notifiedRef = useRef(false);
	useEffect(() => {
		if (!trip) return;
		if (isEmpty) return;
		if (notifiedRef.current) return;
		notifiedRef.current = true;
		notify(
			`Cannot delete owner "${owner?.name ?? ownerId}" — clear the references below first`,
			"error",
		);
	}, [trip, isEmpty, notify, owner, ownerId]);

	useEffect(() => {
		setColor({ border: "red", title: "red" });
		setMenu([], () => {});
		setHints([
			...(hasAccounts && hasExpenses
				? [{ key: "1/2", label: "Switch tab" }]
				: []),
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Edit" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
		setTitle(tripTitle(trip, "Owners", "References", owner?.name ?? ownerId));
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
		owner,
		ownerId,
		hasAccounts,
		hasExpenses,
	]);

	useInput((input) => {
		if (focus === "input") return;
		if (input === "1" && hasAccounts) {
			setActiveTab("accounts");
		} else if (input === "2" && hasExpenses) {
			setActiveTab("expenses");
		}
	});

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (isEmpty) {
		return <Text dimColor>Removing...</Text>;
	}

	const tabsLine =
		hasAccounts && hasExpenses ? (
			<Box flexDirection="column">
				<Box>
					<Text
						bold={activeTab === "accounts"}
						inverse={activeTab === "accounts"}
					>
						{" [1] Accounts ("}
						{refs.accounts.length}
						{") "}
					</Text>
					<Text dimColor> | </Text>
					<Text
						bold={activeTab === "expenses"}
						inverse={activeTab === "expenses"}
					>
						{" [2] Expenses ("}
						{refs.expenses.length}
						{") "}
					</Text>
				</Box>
				<Text dimColor>{"─".repeat(40)}</Text>
			</Box>
		) : null;

	return (
		<Box flexDirection="column">
			{tabsLine}
			{activeTab === "accounts" && hasAccounts ? (
				<ListSelect
					options={refs.accounts.map((a) => ({
						label: a.name,
						value: a.id,
						detail: `(${a.type})`,
					}))}
					onChange={(accountId) => {
						goTo("/trips/accounts/edit", {
							props: { tripDirPath, accountId },
						});
					}}
					isActive={focus === "main"}
				/>
			) : null}
			{activeTab === "expenses" && hasExpenses ? (
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
			) : null}
		</Box>
	);
}
