import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { AccountType } from "../../core/models";
import {
	addAccount,
	removeAccount,
	updateAccount,
} from "../../core/services/account";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type Mode = "list" | "add" | "edit" | "select-for-remove";

interface EditTarget {
	id: string;
	name: string;
	type: string;
	owners: string;
}

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
		placeholder: "e.g. Alice's Visa",
	},
	{
		key: "type",
		label: "Account Type",
		type: "select",
		required: true,
		options: [
			{ label: "Credit", value: "Credit" },
			{ label: "Debit", value: "Debit" },
		],
		defaultValue: "Credit",
	},
	{
		key: "owners",
		label: "Owner IDs (comma-separated)",
		type: "text",
		required: true,
		placeholder: "e.g. alice,bob",
	},
];

export function AccountList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goExit } = useNavigation();
	const { setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor } = useLayout();

	const [mode, setMode] = useState<Mode>("list");
	const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

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

		const hasAccounts = trip.accounts.length > 0;
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasAccounts
					? [{ label: "Remove", value: "remove", key: "x" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					setMode("add");
					setFocus("main");
				} else if (value === "remove" && hasAccounts) {
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
					const ownersStr = values["owners"] ?? "";
					const owners = ownersStr.split(",").map((s) => s.trim());
					if (trip) {
						addAccount(trip, {
							id: toSlug(name),
							name,
							type: (values["type"] ?? "Credit") as AccountType,
							owners,
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
				placeholder: "e.g. Alice's Visa",
				defaultValue: editTarget.name,
			},
			{
				key: "type",
				label: "Account Type",
				type: "select",
				required: true,
				options: [
					{ label: "Credit", value: "Credit" },
					{ label: "Debit", value: "Debit" },
				],
				defaultValue: editTarget.type,
			},
			{
				key: "owners",
				label: "Owner IDs (comma-separated)",
				type: "text",
				required: true,
				placeholder: "e.g. alice,bob",
				defaultValue: editTarget.owners,
			},
		];
		return (
			<Box flexDirection="column">
				<Text dimColor>ID: {editTarget.id}</Text>
				<Form
					fields={editFields}
					onSubmit={(values) => {
						const name = values["name"] ?? editTarget.name;
						const typeStr = values["type"] ?? editTarget.type;
						const ownersStr = values["owners"] ?? editTarget.owners;
						const owners = ownersStr.split(",").map((s) => s.trim());
						if (trip) {
							updateAccount(trip, editTarget.id, {
								name,
								type: typeStr as AccountType,
								owners,
							});
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
		if (!trip || trip.accounts.length === 0) {
			return <Text dimColor>No accounts yet.</Text>;
		}
		return (
			<VerticalSelect
				options={trip.accounts.map((a) => ({
					label: a.name,
					value: a.id,
					detail: `(${a.type})`,
				}))}
				onChange={(value) => {
					if (trip) {
						removeAccount(trip, value);
						reloadTrip();
						if (trip.accounts.length === 0) {
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
		);
	}

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.accounts.length === 0) {
		return <Text dimColor>No accounts yet.</Text>;
	}

	return (
		<VerticalSelect
			options={trip.accounts.map((a) => ({
				label: a.name,
				value: a.id,
				detail: `(${a.type})`,
			}))}
			onChange={(value) => {
				const account = trip.accounts.find((a) => a.id === value);
				if (account) {
					setEditTarget({
						id: account.id,
						name: account.name,
						type: account.type,
						owners: account.owners.join(", "),
					});
					setMode("edit");
					setFocus("main");
				}
			}}
			isActive
		/>
	);
}
