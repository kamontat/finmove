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
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

const BROKEN_PREFIX = "__broken__:";

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
		<ListSelect
			options={entries.map((e) =>
				e.kind === "ok"
					? {
							label: e.trip.settings.name,
							value: e.trip.dirPath,
							detail: `(${e.trip.settings.startDate} — ${e.trip.settings.endDate})`,
						}
					: {
							label: `⚠ ${e.dirName} — ${e.error.name}`,
							value: `${BROKEN_PREFIX}${e.dirPath}`,
							detail: "(broken — press Enter for details)",
						},
			)}
			onChange={(value) => {
				if (value.startsWith(BROKEN_PREFIX)) {
					const dirPath = value.slice(BROKEN_PREFIX.length);
					const entry = entries.find(
						(e): e is Extract<TripEntry, { kind: "broken" }> =>
							e.kind === "broken" && e.dirPath === dirPath,
					);
					if (!entry) return;
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
				const entry = entries.find(
					(e): e is Extract<TripEntry, { kind: "ok" }> =>
						e.kind === "ok" && e.trip.dirPath === value,
				);
				if (entry) {
					goTo("/trips/overview", {
						props: {
							tripDirPath: entry.trip.dirPath,
							tripName: entry.trip.settings.name,
							dataDir,
						},
					});
				}
			}}
			onHighlight={(_, i) => setActiveIndex(i)}
			armedRowIndex={armed?.index ?? null}
			isActive={focus === "main"}
		/>
	);
}
