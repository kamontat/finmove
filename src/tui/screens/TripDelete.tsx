import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { today } from "../../core/services/date";
import {
	deleteTrip,
	listTrips,
	sortTrips,
	type TripEntry,
} from "../../core/services/trip";
import { TableSelect } from "../components/molecules/TableSelect";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";
import { buildTripListRows, TRIP_LIST_HEADERS } from "./TripList";

export function TripDelete(): JSX.Element {
	const { focus } = useFocus();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();
	const { goBack } = useNavigation();
	const { dataDir = "./data" } = useRouteProps("/trips/delete");

	const [entries, setEntries] = useState<TripEntry[]>(() =>
		sortTrips(listTrips(dataDir), today()),
	);

	useEffect(() => {
		setColor({ border: "red", title: "red" });
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitle(["Trips", "Delete"]);
		return () => {
			setColor({});
			clearTitle();
		};
	}, [setColor, setMenu, setHints, setTitle, clearTitle]);

	if (entries.length === 0) {
		return <Text dimColor>No trips.</Text>;
	}

	return (
		<TableSelect
			headers={TRIP_LIST_HEADERS}
			rows={buildTripListRows(entries, today())}
			onChange={(rowIndex) => {
				const entry = entries[rowIndex];
				if (!entry) return;
				const dirPath =
					entry.kind === "ok" ? entry.trip.dirPath : entry.dirPath;
				deleteTrip(dirPath);
				const next = sortTrips(listTrips(dataDir), today());
				setEntries(next);
				if (next.length === 0) {
					goBack();
				}
			}}
			isActive={focus === "main"}
		/>
	);
}
