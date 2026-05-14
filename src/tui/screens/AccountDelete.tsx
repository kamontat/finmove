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
import { useNavigation } from "../states/navigation";

export function AccountDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack } = useNavigation();

	useEffect(() => {
		setBorderColor("red");
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix(null);
		return () => {
			setBorderColor(null);
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.accounts.length === 0) {
		return <Text dimColor>No accounts.</Text>;
	}

	return (
		<RemoveSelector
			header="Select an account to delete:"
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
