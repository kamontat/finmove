import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import {
	findAccountReferences,
	removeAccount,
} from "../../core/services/account";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";

export function AccountList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus, setFocus } = useFocus();
	const { setHints, setColor, setTitleSuffix } = useLayout();
	const { setMenu, armed, setActiveIndex } = useMenu();
	const { goTo, goBack } = useNavigation();

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("account-");
	}, [clearByPrefix]);

	useEffect(() => {
		if (!trip) return;
		setFocus(trip.accounts.length > 0 ? "main" : "menu");
	}, [trip, setFocus]);

	useEffect(() => {
		setTitleSuffix(null);
		setColor({});
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasAccounts = trip.accounts.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasAccounts
					? [
							{
								label: "Delete",
								value: "delete",
								key: "x",
								mainAction: {
									confirmCount: 2,
									check: (i: number) => {
										const acc = trip.accounts[i];
										if (!acc) return false;
										const refs = findAccountReferences(trip, acc.id);
										if (refs.expenses.length > 0) {
											goTo("/trips/accounts/references", {
												props: { tripDirPath, accountId: acc.id },
											});
											return false;
										}
										return true;
									},
									onConfirm: (i: number) => {
										const acc = trip.accounts[i];
										if (!acc) return;
										removeAccount(trip, acc.id);
										reloadTrip();
										if (trip.accounts.length === 0) {
											goBack();
										}
									},
								},
							},
						]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/accounts/new", { props: { tripDirPath } });
				} else if (value === "delete" && hasAccounts) {
					goTo("/trips/accounts/delete", { props: { tripDirPath } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		trip,
		reloadTrip,
		setMenu,
		setHints,
		setColor,
		setTitleSuffix,
		goTo,
		goBack,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.accounts.length === 0) {
		return <Text dimColor>No accounts yet.</Text>;
	}

	return (
		<ListSelect
			options={trip.accounts.map((a) => ({
				label: a.name,
				value: a.id,
				detail: `(${a.type})`,
			}))}
			onChange={(accountId) => {
				goTo("/trips/accounts/edit", {
					props: { tripDirPath: trip.dirPath, accountId },
				});
			}}
			onHighlight={(_, i) => setActiveIndex(i)}
			armedRowIndex={armed?.index ?? null}
			isActive={focus === "main"}
		/>
	);
}
