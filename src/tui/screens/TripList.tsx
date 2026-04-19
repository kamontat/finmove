import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Settings, Trip } from "../../core/models";
import { addDays, today } from "../../core/services/date";
import {
	createTrip,
	deleteTrip,
	duplicateTrip,
	listTrips,
	toDirName,
} from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { DateField } from "../components/molecules/DateField";
import { FormField } from "../components/molecules/FormField";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode =
	| "list"
	| "select-for-duplicate"
	| "select-for-delete"
	| "create-name"
	| "create-start"
	| "create-end"
	| "duplicate-name";

const DEFAULT_SETTINGS: Omit<Settings, "name" | "startDate" | "endDate"> = {
	countries: [],
	baseCurrency: "THB",
	currencies: {},
	categories: [
		"Flight",
		"Hotels",
		"Transportation",
		"Shopping",
		"Eating",
		"Activities",
	],
	tags: [],
	exportPath: "./expenses.csv",
};

export function TripList(): JSX.Element {
	const { goTo, currentRoute } = useNavigation();
	const { focus, setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, resetLayout } = useLayout();

	const dataDir =
		(currentRoute.props["dataDir"] as string | undefined) ?? "./data";

	const [mode, setMode] = useState<Mode>("list");
	const [tripName, setTripName] = useState("");
	const [startDate, setStartDate] = useState("");
	const [targetTrip, setTargetTrip] = useState<Trip | null>(null);
	const [trips, setTrips] = useState<Trip[]>(() => listTrips(dataDir));

	const refreshTrips = () => {
		setTrips(listTrips(dataDir));
	};

	// Register menu in list mode
	useEffect(() => {
		if (mode !== "list") {
			setMenu([], () => {});
			setBorderColor(null);
			return;
		}

		setMenu(
			[
				{ label: "Create", value: "create", key: "c" },
				{ label: "Duplicate", value: "duplicate", key: "d" },
				{ label: "Delete", value: "delete", key: "x" },
			],
			(value) => {
				if (value === "create") {
					setMode("create-name");
					setFocus("input");
				} else if (value === "duplicate" && trips.length > 0) {
					setMode("select-for-duplicate");
					setFocus("main");
				} else if (value === "delete" && trips.length > 0) {
					setMode("select-for-delete");
					setBorderColor("red");
					setFocus("main");
				}
			},
		);
		setHints([{ key: "?", label: "help" }]);
	}, [mode, trips.length, setMenu, setHints, setFocus, setBorderColor]);

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
					setFocus("menu");
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
						const dirName = toDirName(tripName, startDate);
						const settings = {
							...DEFAULT_SETTINGS,
							name: tripName,
							startDate,
							endDate,
						};
						const newTrip = createTrip(dataDir, dirName, settings);
						resetLayout();
						goTo("/trips/menu", {
							props: { tripDirPath: newTrip.dirPath, tripName, dataDir },
						});
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
						deleteTrip(value);
						refreshTrips();
						setMode("list");
						setBorderColor(null);
						setFocus("menu");
					} else {
						setMode("duplicate-name");
						setFocus("input");
					}
				}}
				onCancel={() => {
					setMode("list");
					setBorderColor(null);
					setFocus("menu");
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
					const dirName = toDirName(name, targetTrip.settings.startDate);
					duplicateTrip(dataDir, targetTrip.dirPath, dirName, name);
					refreshTrips();
					setTargetTrip(null);
					setMode("list");
					setFocus("menu");
				}}
				onCancel={() => {
					setTargetTrip(null);
					setMode("select-for-duplicate");
					setFocus("main");
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
				if (trip) {
					goTo("/trips/menu", {
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
