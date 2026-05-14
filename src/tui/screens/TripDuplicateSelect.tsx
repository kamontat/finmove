import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Trip } from "../../core/models";
import { listTrips } from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripDuplicateSelect(): JSX.Element {
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();
	const { dataDir = "./data" } = useRouteProps("/trips/duplicate");

	const [trips] = useState<Trip[]>(() => listTrips(dataDir));

	useEffect(() => {
		setBorderColor(null);
		setMenu([], () => {});
		setHints([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Select trip" },
			{ key: "q/esc", label: "Back to list" },
			{ key: "e", label: "Exit" },
		]);
		setTitleSuffix(null);
		return () => {
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

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
					goTo("/trips/duplicate/new", {
						props: {
							dataDir,
							sourceDirPath: trip.dirPath,
							sourceName: trip.settings.name,
							sourceStartDate: trip.settings.startDate,
						},
					});
				}}
				isActive
			/>
		</Box>
	);
}
