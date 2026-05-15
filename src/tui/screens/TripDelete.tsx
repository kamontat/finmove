import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import {
	deleteTrip,
	listTrips,
	type TripEntry,
} from "../../core/services/trip";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

function entryLabel(entry: TripEntry): string {
	return entry.kind === "ok" ? entry.trip.settings.name : `⚠ ${entry.dirName}`;
}

function entryDirPath(entry: TripEntry): string {
	return entry.kind === "ok" ? entry.trip.dirPath : entry.dirPath;
}

function entryDetail(entry: TripEntry): string {
	return entry.kind === "ok"
		? `(${entry.trip.settings.startDate} — ${entry.trip.settings.endDate})`
		: `(broken — ${entry.error.name})`;
}

export function TripDelete(): JSX.Element {
	const { setHints, setColor, setTitleSuffix } = useLayout();
	const { setMenu } = useMenu();
	const { goBack } = useNavigation();
	const { dataDir = "./data" } = useRouteProps("/trips/delete");

	const [entries, setEntries] = useState<TripEntry[]>(() => listTrips(dataDir));

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

	if (entries.length === 0) {
		return <Text dimColor>No trips.</Text>;
	}

	return (
		<RemoveSelector
			options={entries.map((e) => ({
				label: entryLabel(e),
				value: entryDirPath(e),
				detail: entryDetail(e),
			}))}
			onConfirm={(dirPath) => {
				deleteTrip(dirPath);
				const next = listTrips(dataDir);
				setEntries(next);
				if (next.length === 0) {
					goBack();
				}
			}}
		/>
	);
}
