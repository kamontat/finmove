import { Box } from "ink";
import type { JSX } from "react";
import { useState } from "react";
import type { Trip } from "../../core/models";
import { addDays, today } from "../../core/services/date";
import { listTrips } from "../../core/services/trip";
import { TextLabel } from "../components/atoms/text-label";
import { DateField } from "../components/molecules/date-field";
import { FormField } from "../components/molecules/form-field";
import { NavigationMenu } from "../components/organisms/navigation-menu";

interface TripListProps {
	dataDir: string;
	onSelectTrip: (trip: Trip) => void;
	onCreateTrip: (name: string, startDate: string, endDate: string) => void;
}

type CreateStep = "name" | "start-date" | "end-date";

export function TripList({
	dataDir,
	onSelectTrip,
	onCreateTrip,
}: TripListProps): JSX.Element {
	const [mode, setMode] = useState<"list" | "create">("list");
	const [createStep, setCreateStep] = useState<CreateStep>("name");
	const [tripName, setTripName] = useState("");
	const [startDate, setStartDate] = useState("");
	const trips = listTrips(dataDir);

	if (mode === "create") {
		if (createStep === "name") {
			return (
				<Box flexDirection="column" gap={1}>
					<TextLabel text="Create New Trip" bold color="cyan" />
					<FormField
						label="Trip name:"
						placeholder="e.g. Japan Trip"
						onSubmit={(name) => {
							setTripName(name);
							setCreateStep("start-date");
						}}
					/>
				</Box>
			);
		}
		if (createStep === "start-date") {
			return (
				<Box flexDirection="column" gap={1}>
					<TextLabel text="Create New Trip" bold color="cyan" />
					<TextLabel text={`Name: ${tripName}`} dimColor />
					<DateField
						label="Start date:"
						defaultValue={today()}
						onSubmit={(date) => {
							setStartDate(date);
							setCreateStep("end-date");
						}}
					/>
				</Box>
			);
		}
		// end-date
		return (
			<Box flexDirection="column" gap={1}>
				<TextLabel text="Create New Trip" bold color="cyan" />
				<TextLabel text={`Name: ${tripName}`} dimColor />
				<TextLabel text={`Start: ${startDate}`} dimColor />
				<DateField
					label="End date:"
					defaultValue={addDays(startDate, 1)}
					onSubmit={(endDate) => {
						onCreateTrip(tripName, startDate, endDate);
					}}
				/>
			</Box>
		);
	}

	const options = [
		...trips.map((t, i) => ({
			label: `${t.settings.name} (${t.settings.startDate} — ${t.settings.endDate})`,
			value: t.dirPath,
			key: String(i + 1),
		})),
		{ label: "Create new trip", value: "__create__", key: "c" },
	];

	return (
		<Box flexDirection="column" gap={1}>
			<TextLabel text="Trips" bold color="cyan" />
			<NavigationMenu
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
		</Box>
	);
}
