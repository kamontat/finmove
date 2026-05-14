import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Trip } from "../../core/models";
import { today } from "../../core/services/date";
import { deleteTrip, listTrips, sortTrips } from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripList(): JSX.Element {
	const { goTo, goBack } = useNavigation();
	const { focus } = useFocus();
	const { setHints, setColor, setTitleSuffix } = useLayout();
	const { setMenu, armed, setActiveIndex } = useMenu();

	const { dataDir = "./data" } = useRouteProps("/trips");

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("trip-");
	}, [clearByPrefix]);

	const [trips, setTrips] = useState<Trip[]>(() =>
		sortTrips(listTrips(dataDir), today()),
	);

	useEffect(() => {
		setTitleSuffix(null);
		setColor({});

		setMenu(
			[
				{ label: "Create", value: "create", key: "c" },
				{
					label: "Duplicate",
					value: "duplicate",
					key: "d",
					mainAction: {
						onConfirm: (i) => {
							const t = trips[i];
							if (!t) return;
							goTo("/trips/new", {
								props: { dataDir, duplicateFromDirPath: t.dirPath },
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
							const t = trips[i];
							if (!t) return;
							deleteTrip(t.dirPath);
							const next = sortTrips(listTrips(dataDir), today());
							setTrips(next);
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
				} else if (value === "duplicate" && trips.length > 0) {
					goTo("/trips/duplicate", { props: { dataDir } });
				} else if (value === "delete" && trips.length > 0) {
					goTo("/trips/delete", { props: { dataDir } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		dataDir,
		trips,
		setMenu,
		setHints,
		setColor,
		setTitleSuffix,
		goTo,
		goBack,
	]);

	if (trips.length === 0) {
		return <Text dimColor>No trips yet. Press [c] to create one.</Text>;
	}

	return (
		<ListSelect
			options={trips.map((t) => ({
				label: t.settings.name,
				value: t.dirPath,
				detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
			}))}
			onChange={(value) => {
				const trip = trips.find((t) => t.dirPath === value);
				if (trip) {
					goTo("/trips/overview", {
						props: {
							tripDirPath: trip.dirPath,
							tripName: trip.settings.name,
							dataDir,
						},
					});
				}
			}}
			onHighlight={(_, i) => setActiveIndex(i)}
			armedRowIndex={armed?.value === "delete" ? armed.index : null}
			isActive={focus === "main"}
		/>
	);
}
