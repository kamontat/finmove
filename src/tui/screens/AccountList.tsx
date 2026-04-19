import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { AccountType } from "../../core/models";
import { addAccount, removeAccount } from "../../core/services/account";
import { DataTable } from "../components/organisms/DataTable";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";

type Mode = "list" | "add";

const ADD_FIELDS: FormFieldConfig[] = [
	{
		key: "id",
		label: "Account ID (slug)",
		type: "text",
		required: true,
		placeholder: "e.g. alice-credit",
	},
	{
		key: "name",
		label: "Account Display Name",
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
	const { setMenu, setHints } = useLayout();

	const [mode, setMode] = useState<Mode>("list");

	useEffect(() => {
		if (!trip || mode !== "list") {
			setMenu([], () => {});
			return;
		}

		const menuOptions = [
			{ label: "Add", value: "add", key: "a" },
			...trip.accounts.map((a) => ({
				label: `Remove: ${a.name}`,
				value: `remove:${a.id}`,
			})),
		];

		setMenu(menuOptions, (value) => {
			if (value === "add") {
				setMode("add");
				setFocus("main");
			} else if (value.startsWith("remove:")) {
				const id = value.replace("remove:", "");
				removeAccount(trip, id);
				reloadTrip();
			}
		});
		setHints([{ key: "?", label: "help" }]);
	}, [trip, mode, setMenu, setHints, setFocus, reloadTrip]);

	if (mode === "add") {
		return (
			<Form
				fields={ADD_FIELDS}
				onSubmit={(values) => {
					const ownersStr = values["owners"] ?? "";
					const owners = ownersStr.split(",").map((s) => s.trim());
					if (trip) {
						addAccount(trip, {
							id: values["id"] ?? "",
							name: values["name"] ?? "",
							type: (values["type"] ?? "Credit") as AccountType,
							owners,
						});
						reloadTrip();
					}
					setMode("list");
					setFocus("menu");
				}}
				submitLabel="Add Account"
				submitKey="a"
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
		<DataTable
			headers={["ID", "Name", "Type", "Owners"]}
			rows={trip.accounts.map((a) => [
				a.id,
				a.name,
				a.type,
				a.owners.join(", "),
			])}
		/>
	);
}
