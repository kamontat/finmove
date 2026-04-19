import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { CurrencyConfig } from "../../core/models";
import { updateSettings } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode = "list" | "add" | "edit" | "select-for-remove";

const ADD_FIELDS: FormFieldConfig[] = [
	{
		key: "code",
		label: "Currency Code",
		type: "text",
		required: true,
		placeholder: "e.g. JPY",
	},
	{
		key: "exchangeRate",
		label: "Exchange Rate (to THB)",
		type: "text",
		required: true,
		placeholder: "e.g. 0.23",
	},
];

export function TripSettingsCurrencies(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goExit } = useNavigation();
	const { setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const [mode, setMode] = useState<Mode>("list");
	const [editTarget, setEditTarget] = useState<string | null>(null);

	useEffect(() => {
		setTitleSuffix("Settings > Currencies");

		if (!trip || mode !== "list") {
			setMenu([], () => {});
			if (mode === "add" || mode === "edit") {
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

		const entries = Object.entries(trip.settings.currencies);
		const hasItems = entries.length > 0;
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems
					? [
							{ label: "Edit", value: "edit", key: "e" },
							{ label: "Delete", value: "delete", key: "d" },
						]
					: []),
			],
			(value) => {
				if (value === "add") {
					setMode("add");
					setFocus("main");
				} else if (value === "edit" && hasItems) {
					setMode("edit");
					setFocus("input");
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

	const { currencies } = trip.settings;
	const entries = Object.entries(currencies);

	if (mode === "add") {
		return (
			<Form
				fields={ADD_FIELDS}
				onSubmit={(values) => {
					const code = values["code"]?.trim().toUpperCase();
					const rate = Number.parseFloat(values["exchangeRate"] ?? "");
					if (code && !Number.isNaN(rate)) {
						const updated: Record<string, CurrencyConfig> = {
							...currencies,
							[code]: { exchangeRate: rate },
						};
						updateSettings(trip.dirPath, { currencies: updated });
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

	if (mode === "edit") {
		if (editTarget) {
			if (!currencies[editTarget]) {
				setEditTarget(null);
				setMode("list");
				setFocus("menu");
				return <Text dimColor>Currency no longer exists.</Text>;
			}
			const currentRate = currencies[editTarget].exchangeRate;
			const editFields: FormFieldConfig[] = [
				{
					key: "exchangeRate",
					label: `Exchange Rate for ${editTarget}`,
					type: "text",
					required: true,
					defaultValue: String(currentRate),
				},
			];
			return (
				<Form
					fields={editFields}
					onSubmit={(values) => {
						const rate = Number.parseFloat(values["exchangeRate"] ?? "");
						if (!Number.isNaN(rate)) {
							const updated: Record<string, CurrencyConfig> = {
								...currencies,
								[editTarget]: { exchangeRate: rate },
							};
							updateSettings(trip.dirPath, {
								currencies: updated,
							});
							reloadTrip();
						}
						setEditTarget(null);
						setMode("list");
						setFocus("menu");
					}}
					onCancel={() => {
						setEditTarget(null);
						setMode("list");
						setFocus("menu");
					}}
					onEscape={goExit}
				/>
			);
		}

		// Select which currency to edit
		return (
			<Box flexDirection="column">
				<Text bold>Select a currency to edit:</Text>
				<VerticalSelect
					options={entries.map(([code, config]) => ({
						label: code,
						value: code,
						detail: `rate: ${config.exchangeRate}`,
					}))}
					onChange={(value) => {
						setEditTarget(value);
						setFocus("main");
					}}
					onCancel={() => {
						setMode("list");
						setFocus("menu");
					}}
					onEscape={goExit}
					isActive
				/>
			</Box>
		);
	}

	if (mode === "select-for-remove") {
		if (entries.length === 0) {
			return <Text dimColor>No currencies.</Text>;
		}
		return (
			<Box flexDirection="column">
				<Text bold color="red">
					Select a currency to remove:
				</Text>
				<VerticalSelect
					options={entries.map(([code, config]) => ({
						label: code,
						value: code,
						detail: `rate: ${config.exchangeRate}`,
					}))}
					onChange={(value) => {
						const { [value]: _, ...rest } = currencies;
						updateSettings(trip.dirPath, { currencies: rest });
						reloadTrip();
						if (Object.keys(rest).length === 0) {
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

	if (entries.length === 0) {
		return <Text dimColor>No currencies yet.</Text>;
	}

	return (
		<Box flexDirection="column">
			{entries.map(([code, config]) => (
				<Text key={code}>
					• {code} — {config.exchangeRate}
				</Text>
			))}
		</Box>
	);
}
