import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { daysBetween, today } from "../../core/services/date";
import {
	deleteTrip,
	listTrips,
	sortTrips,
	type TripEntry,
} from "../../core/services/trip";
import type { TableCell } from "../components/molecules/TableSelect";
import { TableSelect } from "../components/molecules/TableSelect";
import { LIST_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

export const TRIP_LIST_HEADERS: string[] = [
	"Name",
	"Start",
	"End",
	"Days",
	"Status",
];

function getPhase(
	startDate: string,
	endDate: string,
	todayDate: string,
): "upcoming" | "ongoing" | "ended" {
	if (todayDate < startDate) return "upcoming";
	if (todayDate > endDate) return "ended";
	return "ongoing";
}

export function buildTripListRows(
	entries: TripEntry[],
	todayDate: string,
): TableCell[][] {
	return entries.map((e) => {
		if (e.kind === "ok") {
			const { name, startDate, endDate } = e.trip.settings;
			const days = daysBetween(startDate, endDate) + 1;
			return [
				{ text: name },
				{ text: startDate },
				{ text: endDate },
				{ text: String(days) },
				{ text: getPhase(startDate, endDate, todayDate) },
			];
		}
		return [
			{ text: `⚠ ${e.dirName}` },
			{ text: "—" },
			{ text: "—" },
			{ text: "—" },
			{ text: "broken" },
		];
	});
}

export function TripList(): JSX.Element {
	const { goTo, goBack } = useNavigation();
	const { focus } = useFocus();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu, armed, setActiveIndex } = useMenu();

	const { dataDir = "./data" } = useRouteProps("/trips");

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("trip-");
	}, [clearByPrefix]);

	const [entries, setEntries] = useState<TripEntry[]>(() =>
		sortTrips(listTrips(dataDir), today()),
	);

	const hasOk = entries.some((e) => e.kind === "ok");

	useEffect(() => {
		setTitle(["Trips"]);
		setColor({});

		setMenu(
			[
				{ label: "Create", value: "create", key: "c" },
				{
					label: "Duplicate",
					value: "duplicate",
					key: "d",
					mainAction: {
						check: (i) => entries[i]?.kind === "ok",
						onConfirm: (i) => {
							const e = entries[i];
							if (!e || e.kind !== "ok") return;
							goTo("/trips/new", {
								props: {
									dataDir,
									duplicateFromDirPath: e.trip.dirPath,
								},
							});
						},
					},
				},
				{
					label: "Delete",
					value: "delete",
					key: "x",
					mainAction: {
						confirmCount: 2,
						onConfirm: (i) => {
							const e = entries[i];
							if (!e) return;
							const path = e.kind === "ok" ? e.trip.dirPath : e.dirPath;
							deleteTrip(path);
							const next = sortTrips(listTrips(dataDir), today());
							setEntries(next);
							if (next.length === 0) {
								goBack();
							}
						},
					},
				},
			],
			(value) => {
				if (value === "create") {
					goTo("/trips/new", { props: { dataDir } });
				} else if (value === "duplicate" && hasOk) {
					goTo("/trips/duplicate", { props: { dataDir } });
				} else if (value === "delete" && entries.length > 0) {
					goTo("/trips/delete", { props: { dataDir } });
				}
			},
		);
		setHints(LIST_HINTS);
		return () => clearTitle();
	}, [
		dataDir,
		entries,
		hasOk,
		setMenu,
		setHints,
		setColor,
		setTitle,
		clearTitle,
		goTo,
		goBack,
	]);

	if (entries.length === 0) {
		return <Text dimColor>No trips yet. Press [c] to create one.</Text>;
	}

	return (
		<TableSelect
			headers={TRIP_LIST_HEADERS}
			rows={buildTripListRows(entries, today())}
			onChange={(rowIndex) => {
				const entry = entries[rowIndex];
				if (!entry) return;
				if (entry.kind === "broken") {
					goTo("/trips/broken", {
						props: {
							dirName: entry.dirName,
							dirPath: entry.dirPath,
							error: entry.error,
							dataDir,
						},
					});
					return;
				}
				goTo("/trips/overview", {
					props: {
						tripDirPath: entry.trip.dirPath,
						tripName: entry.trip.settings.name,
						dataDir,
					},
				});
			}}
			onHighlight={setActiveIndex}
			armedRowIndex={armed?.index ?? null}
			isActive={focus === "main"}
		/>
	);
}
