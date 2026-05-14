import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Trip } from "../../core/models";
import { deleteTrip, listTrips } from "../../core/services/trip";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripDelete(): JSX.Element {
	const { setMenu, setHints, setColor, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();
	const { dataDir = "./data" } = useRouteProps("/trips/delete");

	const [trips, setTrips] = useState<Trip[]>(() => listTrips(dataDir));

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

	if (trips.length === 0) {
		return <Text dimColor>No trips.</Text>;
	}

	return (
		<RemoveSelector
			header="Select a trip to delete:"
			options={trips.map((t) => ({
				label: t.settings.name,
				value: t.dirPath,
				detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
			}))}
			onConfirm={(dirPath) => {
				deleteTrip(dirPath);
				const next = listTrips(dataDir);
				setTrips(next);
				if (next.length === 0) {
					goBack();
				}
			}}
		/>
	);
}
