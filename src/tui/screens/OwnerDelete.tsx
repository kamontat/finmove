import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { findOwnerReferences, removeOwner } from "../../core/services/owner";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function OwnerDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setColor, setTitleSuffix } = useLayout();
	const { goTo, goBack } = useNavigation();

	useEffect(() => {
		setColor({ border: "red", title: "red" });
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix(null);
		return () => {
			setColor({});
			setTitleSuffix(null);
		};
	}, [setColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.owners.length === 0) {
		return <Text dimColor>No owners.</Text>;
	}

	return (
		<RemoveSelector
			header="Select an owner to delete:"
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
