import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Trip } from "../../core/models";
import { deleteTrip, listTrips } from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { LIST_HINTS, SELECT_REMOVE_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripList(): JSX.Element {
	const { goTo, goBack } = useNavigation();
	const { focus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const { dataDir = "./data", selectMode } = useRouteProps("/trips");

	const [trips, setTrips] = useState<Trip[]>(() => listTrips(dataDir));

	useEffect(() => {
		setTitleSuffix(null);

		if (selectMode === "delete") {
			setBorderColor("red");
			setMenu([], () => {});
			setHints(SELECT_REMOVE_HINTS);
			return;
		}
		if (selectMode === "duplicate") {
			setBorderColor(null);
			setMenu([], () => {});
			setHints([
				{ key: "↑↓", label: "Navigate" },
				{ key: "Enter", label: "Select trip" },
				{ key: "q/esc", label: "Back to list" },
				{ key: "e", label: "Exit" },
			]);
			return;
		}

		setBorderColor(null);
		setMenu(
			[
				{ label: "Create", value: "create", key: "c" },
				{ label: "Duplicate", value: "duplicate", key: "d" },
				{ label: "Delete", value: "delete", key: "x" },
			],
			(value) => {
				if (value === "create") {
					goTo("/trips/new", { props: { dataDir } });
				} else if (value === "duplicate" && trips.length > 0) {
					goTo("/trips", {
						props: { dataDir, selectMode: "duplicate" },
					});
				} else if (value === "delete" && trips.length > 0) {
					goTo("/trips", { props: { dataDir, selectMode: "delete" } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		selectMode,
		dataDir,
		trips.length,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

	if (selectMode === "delete") {
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
				onCancel={goBack}
			/>
		);
	}

	if (selectMode === "duplicate") {
		if (trips.length === 0) {
			return <Text dimColor>No trips.</Text>;
		}
		return (
			<Box flexDirection="column">
				<Text bold color="cyan">
					Select a trip to duplicate:
				</Text>
				<ListSelect
					options={trips.map((t) => ({
						label: t.settings.name,
						value: t.dirPath,
						detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
					}))}
					onChange={(dirPath) => {
						const trip = trips.find((t) => t.dirPath === dirPath);
						if (!trip) return;
						goTo("/trips/duplicate", {
							props: {
								dataDir,
								sourceDirPath: trip.dirPath,
								sourceName: trip.settings.name,
								sourceStartDate: trip.settings.startDate,
							},
						});
					}}
					onCancel={goBack}
					isActive
				/>
			</Box>
		);
	}

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
			isActive={focus === "main"}
		/>
	);
}
