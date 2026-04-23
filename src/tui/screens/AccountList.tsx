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

function uniqueSlug(name: string, takenIds: Iterable<string>): string {
	const taken = new Set(takenIds);
	const base = toSlug(name);
	if (!taken.has(base)) return base;
	let i = 2;
	while (taken.has(`${base}-${i}`)) i++;
	return `${base}-${i}`;
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
	const { setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const [mode, setMode] = useState<Mode>("list");
	const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

	useEffect(() => {
		if (!trip || mode !== "list") {
			setMenu([], () => {});
			if (mode === "add" || mode === "edit") {
				if (mode === "add") setTitleSuffix("New");
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
			} else {
				setBorderColor(null);
			}
			return;
		}

		setTitleSuffix(null);
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
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
	}, [trip, mode, setMenu, setHints, setFocus, setBorderColor, setTitleSuffix]);

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
							id: uniqueSlug(
								name,
								trip.accounts.map((a) => a.id),
							),
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
			<Box flexDirection="column">
				<Text bold color="red">
					Select an account to remove:
				</Text>
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
					color="red"
					isActive
				/>
			</Box>
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
					setTitleSuffix(account.name);
					setMode("edit");
					setFocus("main");
				}
			}}
			isActive
		/>
	);
}
