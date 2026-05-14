import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Trip } from "../../core/models";
import { listTrips } from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripDuplicateSelect(): JSX.Element {
	const { setHints, setColor, setTitleSuffix } = useLayout();
	const { setMenu } = useMenu();
	const { goTo } = useNavigation();
	const { dataDir = "./data" } = useRouteProps("/trips/duplicate");

	const [trips] = useState<Trip[]>(() => listTrips(dataDir));

	useEffect(() => {
		setColor({ border: "yellow", title: "yellow" });
		setMenu([], () => {});
		setHints([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Select trip" },
			{ key: "q/esc", label: "Back to list" },
			{ key: "e", label: "Exit" },
		]);
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
		<ListSelect
			options={trips.map((t) => ({
				label: t.settings.name,
				value: t.dirPath,
				detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
			}))}
			onChange={(dirPath) => {
				const trip = trips.find((t) => t.dirPath === dirPath);
				if (!trip) return;
				goTo("/trips/new", {
					props: { dataDir, duplicateFromDirPath: trip.dirPath },
				});
			}}
			isActive
		/>
	);
}
