import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Trip } from "../../core/models";
import { addDays, today } from "../../core/services/date";
import { listTrips } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { DateField } from "../components/molecules/DateField";
import { FormField } from "../components/molecules/FormField";

interface TripListProps {
	dataDir: string;
	onSelectTrip: (trip: Trip) => void;
	onCreateTrip: (name: string, startDate: string, endDate: string) => void;
	onDuplicateTrip: (sourcePath: string, newName: string) => void;
	onDeleteTrip: (tripPath: string) => void;
	pendingAction: string | null;
	onActionConsumed: () => void;
	onCancelAction: () => void;
	focus: "main" | "menu";
}

type Mode =
	| "list"
	| "select-for-duplicate"
	| "select-for-delete"
	| "create-name"
	| "create-start"
	| "create-end"
	| "duplicate-name";

export function TripList({
	dataDir,
	onSelectTrip,
	onCreateTrip,
	onDuplicateTrip,
	onDeleteTrip,
	pendingAction,
	onActionConsumed,
	onCancelAction,
	focus,
}: TripListProps): JSX.Element {
	const [mode, setMode] = useState<Mode>("list");
	const [tripName, setTripName] = useState("");
	const [startDate, setStartDate] = useState("");
	const [targetTrip, setTargetTrip] = useState<Trip | null>(null);
	const trips = listTrips(dataDir);

	useEffect(() => {
		if (!pendingAction || mode !== "list") return;
		if (pendingAction === "create") {
			setMode("create-name");
		} else if (pendingAction === "duplicate" && trips.length > 0) {
			setMode("select-for-duplicate");
		} else if (pendingAction === "delete" && trips.length > 0) {
			setMode("select-for-delete");
		}
		onActionConsumed();
	}, [pendingAction, mode, onActionConsumed, trips.length]);

	// --- Create flow ---
	if (mode === "create-name") {
		return (
			<FormField
				label="Trip name:"
				placeholder="e.g. Japan Trip"
				onSubmit={(name) => {
					setTripName(name);
					setMode("create-start");
				}}
				onCancel={() => {
					setMode("list");
					onCancelAction();
				}}
			/>
		);
	}

	if (mode === "create-start") {
		return (
			<Box flexDirection="column">
				<Text dimColor>Name: {tripName}</Text>
				<DateField
					label="Start date:"
					defaultValue={today()}
					onSubmit={(date) => {
						setStartDate(date);
						setMode("create-end");
					}}
					onCancel={() => setMode("create-name")}
				/>
			</Box>
		);
	}

	if (mode === "create-end") {
		return (
			<Box flexDirection="column">
				<Text dimColor>Name: {tripName}</Text>
				<Text dimColor>Start: {startDate}</Text>
				<DateField
					label="End date:"
					defaultValue={addDays(startDate, 1)}
					onSubmit={(endDate) => {
						onCreateTrip(tripName, startDate, endDate);
						setMode("list");
					}}
					onCancel={() => setMode("create-start")}
				/>
			</Box>
		);
	}

	// --- Select trip for duplicate/delete ---
	if (mode === "select-for-duplicate" || mode === "select-for-delete") {
		const isDelete = mode === "select-for-delete";
		return (
			<VerticalSelect
				options={trips.map((t) => ({
					label: t.settings.name,
					value: t.dirPath,
					detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
				}))}
				onChange={(value) => {
					const trip = trips.find((t) => t.dirPath === value);
					if (!trip) return;
					setTargetTrip(trip);
					if (isDelete) {
						onDeleteTrip(value);
						setMode("list");
						onCancelAction();
					} else {
						setMode("duplicate-name");
					}
				}}
				onCancel={() => {
					setMode("list");
					onCancelAction();
				}}
				{...(isDelete ? { color: "red" } : {})}
				isActive
			/>
		);
	}

	// --- Duplicate: ask for name ---
	if (mode === "duplicate-name" && targetTrip) {
		return (
			<FormField
				label={`Duplicate "${targetTrip.settings.name}" — new name:`}
				placeholder="e.g. Japan Trip v2"
				onSubmit={(name) => {
					onDuplicateTrip(targetTrip.dirPath, name);
					setTargetTrip(null);
					setMode("list");
				}}
				onCancel={() => {
					setTargetTrip(null);
					setMode("select-for-duplicate");
				}}
			/>
		);
	}

	// --- Default: trip list ---
	if (trips.length === 0) {
		return <Text dimColor>No trips yet. Press [c] to create one.</Text>;
	}

	return (
		<VerticalSelect
			options={trips.map((t) => ({
				label: t.settings.name,
				value: t.dirPath,
				detail: `(${t.settings.startDate} — ${t.settings.endDate})`,
			}))}
			onChange={(value) => {
				const trip = trips.find((t) => t.dirPath === value);
				if (trip) onSelectTrip(trip);
			}}
			isActive={focus === "main"}
		/>
	);
}
