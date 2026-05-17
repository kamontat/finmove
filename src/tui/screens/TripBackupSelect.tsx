import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { today } from "../../core/services/date";
import {
	backupTrip,
	listTrips,
	sortTrips,
	type TripEntry,
} from "../../core/services/trip";
import { TableSelect } from "../components/molecules/TableSelect";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";
import { buildTripListRows, TRIP_LIST_HEADERS } from "./TripList";

export function TripBackupSelect(): JSX.Element {
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { focus } = useFocus();
	const { setMenu } = useMenu();
	const { goTo } = useNavigation();
	const { dataDir = "./data" } = useRouteProps("/trips/backup");

	const [entries] = useState<TripEntry[]>(() =>
		sortTrips(listTrips(dataDir), today()).filter((e) => e.kind === "ok"),
	);

	useEffect(() => {
		setColor({ border: "yellow", title: "yellow" });
		setMenu([], () => {});
		setHints([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Backup trip" },
			{ key: "q/esc", label: "Back to list" },
			{ key: "e", label: "Exit" },
		]);
		setTitle(["Trips", "Backup"]);
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
				backupTrip(dataDir, entry.trip.dirPath);
				goTo("/trips", { replace: true, props: { dataDir } });
			}}
			isActive={focus === "main"}
		/>
	);
}
