import { Text } from "ink";
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
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode =
	| "list"
	| "select-for-duplicate"
	| "select-for-delete"
	| "create"
	| "duplicate";

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

const CREATE_FIELDS: FormFieldConfig[] = [
	{
		key: "name",
		label: "Trip Name",
		type: "text",
		required: true,
		placeholder: "e.g. Japan Trip",
	},
	{
		key: "startDate",
		label: "Start Date",
		type: "date",
		required: true,
		defaultValue: today(),
	},
	{
		key: "endDate",
		label: "End Date",
		type: "date",
		required: true,
		defaultValue: addDays(today(), 1),
	},
];

const DUPLICATE_FIELDS: FormFieldConfig[] = [
	{
		key: "newName",
		label: "New Trip Name",
		type: "text",
		required: true,
		placeholder: "e.g. Japan Trip v2",
	},
];

export function TripList(): JSX.Element {
	const { goTo, currentRoute } = useNavigation();
	const { focus, setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, resetLayout } = useLayout();

	const dataDir =
		(currentRoute.props["dataDir"] as string | undefined) ?? "./data";

	const [mode, setMode] = useState<Mode>("list");
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
					setMode("create");
					setFocus("main");
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
	if (mode === "create") {
		return (
			<Form
				fields={CREATE_FIELDS}
				onSubmit={(values) => {
					const name = values["name"] ?? "";
					const startDate = values["startDate"] ?? today();
					const endDate = values["endDate"] ?? addDays(today(), 1);
					const dirName = toDirName(name, startDate);
					const settings: Settings = {
						...DEFAULT_SETTINGS,
						name,
						startDate,
						endDate,
					};
					const newTrip = createTrip(dataDir, dirName, settings);
					resetLayout();
					goTo("/trips/menu", {
						props: { tripDirPath: newTrip.dirPath, tripName: name, dataDir },
					});
				}}
				submitLabel="Create Trip"
				submitKey="c"
			/>
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
						setMode("duplicate");
						setFocus("main");
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
	if (mode === "duplicate" && targetTrip) {
		return (
			<Form
				fields={DUPLICATE_FIELDS}
				onSubmit={(values) => {
					const name = values["newName"] ?? "";
					const dirName = toDirName(name, targetTrip.settings.startDate);
					duplicateTrip(dataDir, targetTrip.dirPath, dirName, name);
					refreshTrips();
					setTargetTrip(null);
					setMode("list");
					setFocus("menu");
				}}
				submitLabel="Duplicate Trip"
				submitKey="d"
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
