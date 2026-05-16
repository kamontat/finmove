import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { today } from "../../core/services/date";
import { listTrips, sortTrips, type TripEntry } from "../../core/services/trip";
import { TableSelect } from "../components/molecules/TableSelect";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";
import { buildTripListRows, TRIP_LIST_HEADERS } from "./TripList";

export function TripDuplicateSelect(): JSX.Element {
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();
	const { goTo } = useNavigation();
	const { dataDir = "./data" } = useRouteProps("/trips/duplicate");

	// Only healthy trips can be duplicated — can't copy what we can't read.
	const [entries] = useState<TripEntry[]>(() =>
		sortTrips(listTrips(dataDir), today()).filter((e) => e.kind === "ok"),
	);

	useEffect(() => {
		setColor({ border: "yellow", title: "yellow" });
		setMenu([], () => {});
		setHints([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Select trip" },
			{ key: "q/esc", label: "Back to list" },
			{ key: "e", label: "Exit" },
		]);
		setTitle(["Trips", "Duplicate"]);
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
				if (!entry || entry.kind !== "ok") return;
				goTo("/trips/new", {
					replace: true,
					props: { dataDir, duplicateFromDirPath: entry.trip.dirPath },
				});
			}}
			isActive
		/>
	);
}
