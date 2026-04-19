import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { updateSettings } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode = "list" | "add" | "select-for-remove";

const ADD_FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Country",
		type: "text",
		required: true,
		placeholder: "e.g. Japan",
	},
];

export function TripSettingsCountries(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goExit } = useNavigation();
	const { setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const [mode, setMode] = useState<Mode>("list");

	useEffect(() => {
		setTitleSuffix("Settings > Countries");

		if (!trip || mode !== "list") {
			setMenu([], () => {});
			if (mode === "add") {
				setBorderColor(null);
				setHints([
					{ key: "↑↓", label: "Navigate" },
					{ key: "Enter", label: "Edit field" },
					{ key: "q", label: "Back" },
					{ key: "esc", label: "Exit" },
				]);
			} else if (mode === "select-for-remove") {
				setBorderColor("red");
				setHints([
					{ key: "↑↓", label: "Navigate" },
					{ key: "Enter", label: "Remove selected" },
					{ key: "q", label: "Back to list" },
					{ key: "esc", label: "Exit" },
				]);
			}
			return;
		}

		const hasItems = trip.settings.countries.length > 0;
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems ? [{ label: "Delete", value: "delete", key: "d" }] : []),
			],
			(value) => {
				if (value === "add") {
					setMode("add");
					setFocus("main");
				} else if (value === "delete" && hasItems) {
					setMode("select-for-remove");
					setFocus("input");
				}
			},
		);
		setBorderColor(null);
		setHints([
			{ key: "tab", label: "Switch focus" },
			{ key: "←→", label: "Navigate menu" },
			{ key: "Enter", label: "Confirm" },
			{ key: "q", label: "Back" },
			{ key: "esc", label: "Exit" },
		]);
	}, [trip, mode, setMenu, setHints, setFocus, setBorderColor, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { countries } = trip.settings;

	if (mode === "add") {
		return (
			<Form
				fields={ADD_FIELDS}
				onSubmit={(values) => {
					const value = values["value"]?.trim();
					if (value) {
						updateSettings(trip.dirPath, {
							countries: [...countries, value],
						});
						reloadTrip();
					}
					setMode("list");
					setFocus("menu");
				}}
				onCancel={() => {
					setMode("list");
					setFocus("menu");
				}}
				onEscape={goExit}
			/>
		);
	}

	if (mode === "select-for-remove") {
		if (countries.length === 0) {
			return <Text dimColor>No countries.</Text>;
		}
		return (
			<Box flexDirection="column">
				<Text bold color="red">
					Select a country to remove:
				</Text>
				<VerticalSelect
					options={countries.map((c) => ({ label: c, value: c }))}
					onChange={(value) => {
						updateSettings(trip.dirPath, {
							countries: countries.filter((c) => c !== value),
						});
						reloadTrip();
						const remaining = countries.filter((c) => c !== value);
						if (remaining.length === 0) {
							setMode("list");
							setBorderColor(null);
							setFocus("menu");
						}
					}}
					onCancel={() => {
						setMode("list");
						setBorderColor(null);
						setFocus("menu");
					}}
					onEscape={goExit}
					color="red"
					isActive
				/>
			</Box>
		);
	}

	if (countries.length === 0) {
		return <Text dimColor>No countries yet.</Text>;
	}

	return (
		<Box flexDirection="column">
			{countries.map((c) => (
				<Text key={c}>• {c}</Text>
			))}
		</Box>
	);
}
