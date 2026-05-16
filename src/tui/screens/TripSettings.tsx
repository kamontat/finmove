import { basename } from "node:path";
import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { type FormFieldConfig, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { settingsTitle } from "../utils/titles";

export function TripSettings(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goTo, goBack } = useNavigation();
	const { setHints, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();

	useEffect(() => {
		setTitle(settingsTitle(trip));
		return () => clearTitle();
	}, [setTitle, clearTitle, trip]);

	useEffect(() => {
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;

		setMenu(
			[
				{ label: "Countries", value: "countries", key: "c" },
				{ label: "Categories", value: "categories", key: "g" },
				{ label: "Tags", value: "tags", key: "t" },
				{ label: "Currencies", value: "currencies", key: "r" },
				{ label: "Export CSV", value: "export", key: "x" },
			],
			(value) => {
				if (value === "countries") {
					goTo("/trips/settings/countries", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "categories") {
					goTo("/trips/settings/categories", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "tags") {
					goTo("/trips/settings/tags", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "currencies") {
					goTo("/trips/settings/currencies", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "export") {
					goTo("/trips/settings/export", {
						props: { tripDirPath, tripName },
					});
				}
			},
		);
		setHints([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Edit field" },
			{ key: "s", label: "Submit" },
			{ key: "tab", label: "Switch focus" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
	}, [trip, setMenu, setHints, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { settings } = trip;

	const fields: FormFieldConfig[] = [
		{
			key: "dirName",
			label: "Directory",
			type: "display",
			value: basename(trip.dirPath),
		},
		{
			key: "name",
			label: "Name",
			type: "text",
			required: true,
			defaultValue: settings.name,
		},
		{
			key: "startDate",
			label: "Start Date",
			type: "date",
			required: true,
			defaultValue: settings.startDate,
		},
		{
			key: "endDate",
			label: "End Date",
			type: "date",
			required: true,
			defaultValue: settings.endDate,
		},
		{
			key: "exportPath",
			label: "Export Path",
			type: "text",
			defaultValue: settings.exportPath,
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				updateSettings(trip.dirPath, {
					name: getString(values, "name") || settings.name,
					startDate: getString(values, "startDate") || settings.startDate,
					endDate: getString(values, "endDate") || settings.endDate,
					exportPath: getString(values, "exportPath") || settings.exportPath,
				});
				reloadTrip();
				goBack();
			}}
		/>
	);
}
