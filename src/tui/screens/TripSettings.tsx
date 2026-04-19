import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode = "view" | "edit";

export function TripSettings(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goTo, goExit } = useNavigation();
	const { setFocus } = useFocus();
	const { setMenu, setHints, setTitleSuffix } = useLayout();

	const [mode, setMode] = useState<Mode>("view");

	useEffect(() => {
		setTitleSuffix("Settings");

		if (!trip) return;

		if (mode === "edit") {
			setMenu([], () => {});
			setHints([
				{ key: "↑↓", label: "Navigate" },
				{ key: "Enter", label: "Edit field" },
				{ key: "s", label: "Submit" },
				{ key: "q", label: "Back" },
				{ key: "esc", label: "Exit" },
			]);
			return;
		}

		setMenu(
			[
				{ label: "Edit", value: "edit", key: "e" },
				{ label: "Countries", value: "countries", key: "c" },
				{ label: "Categories", value: "categories", key: "g" },
				{ label: "Tags", value: "tags", key: "t" },
				{ label: "Currencies", value: "currencies", key: "r" },
			],
			(value) => {
				const tripDirPath = trip.dirPath;
				const tripName = trip.settings.name;
				if (value === "edit") {
					setMode("edit");
					setFocus("main");
				} else if (value === "countries") {
					goTo("/trips/settings/countries", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "categories") {
					goTo("/trips/settings/categories", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "tags") {
					goTo("/trips/settings/tags", { props: { tripDirPath, tripName } });
				} else if (value === "currencies") {
					goTo("/trips/settings/currencies", {
						props: { tripDirPath, tripName },
					});
				}
			},
		);
		setHints([
			{ key: "tab", label: "Switch focus" },
			{ key: "←→", label: "Navigate menu" },
			{ key: "Enter", label: "Confirm" },
			{ key: "q", label: "Back" },
			{ key: "esc", label: "Exit" },
		]);
	}, [trip, mode, setMenu, setHints, setFocus, setTitleSuffix, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { settings } = trip;

	if (mode === "edit") {
		const fields: FormFieldConfig[] = [
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
						name: values["name"] ?? settings.name,
						startDate: values["startDate"] ?? settings.startDate,
						endDate: values["endDate"] ?? settings.endDate,
						exportPath: values["exportPath"] ?? settings.exportPath,
					});
					reloadTrip();
					setMode("view");
					setFocus("menu");
				}}
				onCancel={() => {
					setMode("view");
					setFocus("menu");
				}}
				onEscape={goExit}
			/>
		);
	}

	return (
		<Box flexDirection="column" gap={1}>
			<Box flexDirection="column">
				<Text>
					<Text bold>Name: </Text>
					<Text>{settings.name}</Text>
				</Text>
				<Text>
					<Text bold>Dates: </Text>
					<Text>
						{settings.startDate} — {settings.endDate}
					</Text>
				</Text>
				<Text>
					<Text bold>Export: </Text>
					<Text>{settings.exportPath}</Text>
				</Text>
			</Box>
			<Box flexDirection="column">
				<Text>
					<Text bold>Countries: </Text>
					<Text>{settings.countries.join(", ") || "—"}</Text>
				</Text>
				<Text>
					<Text bold>Categories: </Text>
					<Text>{settings.categories.join(", ") || "—"}</Text>
				</Text>
				<Text>
					<Text bold>Tags: </Text>
					<Text>{settings.tags.join(", ") || "—"}</Text>
				</Text>
				<Text>
					<Text bold>Currencies: </Text>
					<Text>
						{Object.entries(settings.currencies)
							.map(([code, config]) => `${code} (${config.exchangeRate})`)
							.join(", ") || "—"}
					</Text>
				</Text>
			</Box>
		</Box>
	);
}
