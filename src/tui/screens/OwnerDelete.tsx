import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { findOwnerReferences, removeOwner } from "../../core/services/owner";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { tripTitle } from "../utils/titles";

export function OwnerDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();
	const { goTo, goBack } = useNavigation();

	useEffect(() => {
		setColor({ border: "red", title: "red" });
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitle(tripTitle(trip, "Owners", "Delete"));
		return () => {
			setColor({});
			clearTitle();
		};
	}, [setColor, setMenu, setHints, setTitle, clearTitle, trip]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.owners.length === 0) {
		return <Text dimColor>No owners.</Text>;
	}

	return (
		<RemoveSelector
			options={trip.owners.map((o) => ({
				label: o.name,
				value: o.id,
				detail: `(${o.id})`,
			}))}
			onConfirm={(value) => {
				const refs = findOwnerReferences(trip, value);
				if (refs.accounts.length === 0 && refs.expenses.length === 0) {
					removeOwner(trip, value);
					reloadTrip();
					if (trip.owners.length === 0) {
						goBack();
					}
					return;
				}
				goTo("/trips/owners/references", {
					props: { tripDirPath: trip.dirPath, ownerId: value },
				});
			}}
		/>
	);
}
