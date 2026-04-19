import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { addOwner, removeOwner } from "../../core/services/owner";
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
		label: "Owner ID (slug)",
		type: "text",
		required: true,
		placeholder: "e.g. alice",
	},
	{
		key: "name",
		label: "Owner Display Name",
		type: "text",
		required: true,
		placeholder: "e.g. Alice",
	},
];

export function OwnerList(): JSX.Element {
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
			...trip.owners.map((o) => ({
				label: `Remove: ${o.name}`,
				value: `remove:${o.id}`,
			})),
		];

		setMenu(menuOptions, (value) => {
			if (value === "add") {
				setMode("add");
				setFocus("main");
			} else if (value.startsWith("remove:")) {
				const id = value.replace("remove:", "");
				removeOwner(trip, id);
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
					if (trip) {
						addOwner(trip, {
							id: values["id"] ?? "",
							name: values["name"] ?? "",
						});
						reloadTrip();
					}
					setMode("list");
					setFocus("menu");
				}}
				submitLabel="Add Owner"
				submitKey="a"
			/>
		);
	}

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.owners.length === 0) {
		return <Text dimColor>No owners yet.</Text>;
	}

	return (
		<DataTable
			headers={["ID", "Name"]}
			rows={trip.owners.map((o) => [o.id, o.name])}
		/>
	);
}
