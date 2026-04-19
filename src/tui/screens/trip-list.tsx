import { Box } from "ink";
import type { JSX } from "react";
import { useState } from "react";
import type { Trip } from "../../core/models";
import { listTrips } from "../../core/services/trip";
import { TextLabel } from "../components/atoms/text-label";
import { FormField } from "../components/molecules/form-field";
import { NavigationMenu } from "../components/organisms/navigation-menu";

interface TripListProps {
	dataDir: string;
	onSelectTrip: (trip: Trip) => void;
	onCreateTrip: (dirName: string) => void;
}

export function TripList({
	dataDir,
	onSelectTrip,
	onCreateTrip,
}: TripListProps): JSX.Element {
	const [mode, setMode] = useState<"list" | "create">("list");
	const trips = listTrips(dataDir);

	if (mode === "create") {
		return (
			<Box flexDirection="column" gap={1}>
				<TextLabel text="Create New Trip" bold color="cyan" />
				<FormField
					label="Trip directory name:"
					placeholder="e.g. japan-2026"
					onSubmit={(name) => onCreateTrip(name)}
				/>
			</Box>
		);
	}

	const options = [
		...trips.map((t) => ({
			label: `${t.settings.name} (${t.settings.startDate} — ${t.settings.endDate})`,
			value: t.dirPath,
		})),
		{ label: "+ Create new trip", value: "__create__" },
	];

	return (
		<NavigationMenu
			title="Select a Trip"
			options={options}
			onSelect={(value) => {
				if (value === "__create__") {
					setMode("create");
					return;
				}
				const trip = trips.find((t) => t.dirPath === value);
				if (trip) onSelectTrip(trip);
			}}
		/>
	);
}
