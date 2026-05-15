import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import {
	findAccountReferences,
	removeAccount,
} from "../../core/services/account";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { tripTitle } from "../utils/titles";

export function AccountDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();
	const { goTo, goBack } = useNavigation();

	useEffect(() => {
		setColor({ border: "red", title: "red" });
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitle(tripTitle(trip, "Accounts", "Delete"));
		return () => {
			setColor({});
			clearTitle();
		};
	}, [setColor, setMenu, setHints, setTitle, clearTitle, trip]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.accounts.length === 0) {
		return <Text dimColor>No accounts.</Text>;
	}

	return (
		<RemoveSelector
			options={trip.accounts.map((a) => ({
				label: a.name,
				value: a.id,
				detail: `(${a.type})`,
			}))}
			onConfirm={(value) => {
				const refs = findAccountReferences(trip, value);
				if (refs.expenses.length === 0) {
					removeAccount(trip, value);
					reloadTrip();
					if (trip.accounts.length === 0) {
						goBack();
					}
					return;
				}
				goTo("/trips/accounts/references", {
					props: { tripDirPath: trip.dirPath, accountId: value },
				});
			}}
		/>
	);
}
