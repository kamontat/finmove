import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Owner } from "../../core/models";
import { addOwner, removeOwner, updateOwner } from "../../core/services/owner";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode = "list" | "add" | "edit" | "select-for-remove";

function toSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

const ADD_FIELDS: FormFieldConfig[] = [
	{
		key: "name",
		label: "Display name",
		type: "text",
		required: true,
		placeholder: "e.g. Alice",
	},
];

export function OwnerList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goExit } = useNavigation();
	const { setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor } = useLayout();

	const [mode, setMode] = useState<Mode>("list");
	const [editTarget, setEditTarget] = useState<Owner | null>(null);

	useEffect(() => {
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
			} else {
				setBorderColor(null);
			}
			return;
		}

		const hasOwners = trip.owners.length > 0;
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasOwners ? [{ label: "Remove", value: "remove", key: "x" }] : []),
			],
			(value) => {
				if (value === "add") {
					setMode("add");
					setFocus("main");
				} else if (value === "remove" && hasOwners) {
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
	}, [trip, mode, setMenu, setHints, setFocus, setBorderColor]);

	if (mode === "add") {
		return (
			<Form
				fields={ADD_FIELDS}
				onSubmit={(values) => {
					const name = values["name"] ?? "";
					if (trip) {
						addOwner(trip, {
							id: toSlug(name),
							name,
						});
						reloadTrip();
					}
					setMode("list");
					setFocus("menu");
				}}
			/>
		);
	}

	if (mode === "edit" && editTarget) {
		const editFields: FormFieldConfig[] = [
			{
				key: "name",
				label: "Display name",
				type: "text",
				required: true,
				placeholder: "e.g. Alice",
				defaultValue: editTarget.name,
			},
		];
		return (
			<Box flexDirection="column">
				<Text dimColor>ID: {editTarget.id}</Text>
				<Form
					fields={editFields}
					onSubmit={(values) => {
						const name = values["name"] ?? editTarget.name;
						if (trip) {
							updateOwner(trip, editTarget.id, name);
							reloadTrip();
						}
						setEditTarget(null);
						setMode("list");
						setFocus("menu");
					}}
				/>
			</Box>
		);
	}

	if (mode === "select-for-remove") {
		if (!trip || trip.owners.length === 0) {
			return <Text dimColor>No owners yet.</Text>;
		}
		return (
			<Box flexDirection="column">
				<Text bold color="red">
					Select an owner to remove:
				</Text>
				<VerticalSelect
					options={trip.owners.map((o) => ({
						label: o.name,
						value: o.id,
						detail: `(${o.id})`,
					}))}
					onChange={(value) => {
						if (trip) {
							removeOwner(trip, value);
							reloadTrip();
							if (trip.owners.length === 0) {
								setMode("list");
								setBorderColor(null);
								setFocus("menu");
							}
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

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.owners.length === 0) {
		return <Text dimColor>No owners yet.</Text>;
	}

	return (
		<VerticalSelect
			options={trip.owners.map((o) => ({
				label: o.name,
				value: o.id,
				detail: `(${o.id})`,
			}))}
			onChange={(value) => {
				const owner = trip.owners.find((o) => o.id === value);
				if (owner) {
					setEditTarget(owner);
					setMode("edit");
					setFocus("main");
				}
			}}
			isActive
		/>
	);
}
