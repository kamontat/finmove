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

type Mode = "list" | "add" | "select-for-remove";

const ADD_FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Tag",
		type: "text",
		required: true,
		placeholder: "e.g. business",
	},
];

export function TripSettingsTags(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const [mode, setMode] = useState<Mode>("list");

	useEffect(() => {
		setTitleSuffix("Settings > Tags");

		if (!trip || mode !== "list") {
			setMenu([], () => {});
			if (mode === "add") {
				setBorderColor(null);
				setHints([
					{ key: "↑↓", label: "Navigate" },
					{ key: "Enter", label: "Edit field" },
					{ key: "q/esc", label: "Back" },
					{ key: "e", label: "Exit" },
				]);
			} else if (mode === "select-for-remove") {
				setBorderColor("red");
				setHints([
					{ key: "↑↓", label: "Navigate" },
					{ key: "Enter", label: "Remove selected" },
					{ key: "q/esc", label: "Back to list" },
					{ key: "e", label: "Exit" },
				]);
			}
			return;
		}

		const hasItems = trip.settings.tags.length > 0;
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
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
	}, [trip, mode, setMenu, setHints, setFocus, setBorderColor, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { tags } = trip.settings;

	if (mode === "add") {
		return (
			<Form
				fields={ADD_FIELDS}
				onSubmit={(values) => {
					const value = values["value"]?.trim();
					if (value) {
						updateSettings(trip.dirPath, {
							tags: [...tags, value],
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
			/>
		);
	}

	if (mode === "select-for-remove") {
		if (tags.length === 0) {
			return <Text dimColor>No tags.</Text>;
		}
		return (
			<Box flexDirection="column">
				<Text bold color="red">
					Select a tag to remove:
				</Text>
				<VerticalSelect
					options={tags.map((t) => ({ label: t, value: t }))}
					onChange={(value) => {
						updateSettings(trip.dirPath, {
							tags: tags.filter((t) => t !== value),
						});
						reloadTrip();
						const remaining = tags.filter((t) => t !== value);
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
					color="red"
					isActive
				/>
			</Box>
		);
	}

	if (tags.length === 0) {
		return <Text dimColor>No tags yet.</Text>;
	}

	return (
		<Box flexDirection="column">
			{tags.map((t) => (
				<Text key={t}>• {t}</Text>
			))}
		</Box>
	);
}
