import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { addOwner, removeOwner } from "../../core/services/owner";
import { ConfirmPrompt } from "../components/molecules/ConfirmPrompt";
import { FormField } from "../components/molecules/FormField";
import { DataTable } from "../components/organisms/DataTable";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";

type Mode = "list" | "add-id" | "add-name" | "remove";

export function OwnerList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setFocus } = useFocus();
	const { setMenu, setHints } = useLayout();

	const [mode, setMode] = useState<Mode>("list");
	const [newId, setNewId] = useState("");
	const [removeId, setRemoveId] = useState<string | null>(null);

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
				setMode("add-id");
				setFocus("input");
			} else if (value.startsWith("remove:")) {
				const id = value.replace("remove:", "");
				setRemoveId(id);
				setMode("remove");
				setFocus("input");
			}
		});
		setHints([{ key: "?", label: "help" }]);
	}, [trip, mode, setMenu, setHints, setFocus]);

	if (mode === "add-id") {
		return (
			<FormField
				label="Owner ID (slug):"
				placeholder="e.g. alice"
				onSubmit={(id) => {
					setNewId(id);
					setMode("add-name");
				}}
			/>
		);
	}

	if (mode === "add-name") {
		return (
			<FormField
				label="Owner display name:"
				placeholder="e.g. Alice"
				onSubmit={(name) => {
					if (trip) {
						addOwner(trip, { id: newId, name });
						reloadTrip();
					}
					setMode("list");
					setFocus("menu");
				}}
			/>
		);
	}

	if (mode === "remove" && removeId) {
		return (
			<ConfirmPrompt
				message={`Remove owner "${removeId}"?`}
				onConfirm={(yes) => {
					if (yes && trip) {
						removeOwner(trip, removeId);
						reloadTrip();
					}
					setRemoveId(null);
					setMode("list");
					setFocus("menu");
				}}
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
