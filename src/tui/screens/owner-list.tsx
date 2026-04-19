import { Box } from "ink";
import type { JSX } from "react";
import { useState } from "react";
import type { Trip } from "../../core/models";
import { addOwner, removeOwner } from "../../core/services/owner";
import { TextLabel } from "../components/atoms/text-label";
import { ConfirmPrompt } from "../components/molecules/confirm-prompt";
import { FormField } from "../components/molecules/form-field";
import { DataTable } from "../components/organisms/data-table";
import { NavigationMenu } from "../components/organisms/navigation-menu";

interface OwnerListProps {
	trip: Trip;
	onBack: () => void;
	onTripUpdated: () => void;
}

type Mode = "list" | "add-id" | "add-name" | "remove";

export function OwnerList({
	trip,
	onBack,
	onTripUpdated,
}: OwnerListProps): JSX.Element {
	const [mode, setMode] = useState<Mode>("list");
	const [newId, setNewId] = useState("");
	const [removeId, setRemoveId] = useState<string | null>(null);

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
					addOwner(trip, { id: newId, name });
					onTripUpdated();
					setMode("list");
				}}
			/>
		);
	}

	if (mode === "remove" && removeId) {
		return (
			<ConfirmPrompt
				message={`Remove owner "${removeId}"?`}
				onConfirm={(yes) => {
					if (yes) {
						removeOwner(trip, removeId);
						onTripUpdated();
					}
					setRemoveId(null);
					setMode("list");
				}}
			/>
		);
	}

	const rows = trip.owners.map((o) => [o.id, o.name]);

	const menuOptions = [
		{ label: "Add owner", value: "add" },
		...trip.owners.map((o) => ({
			label: `Remove ${o.name}`,
			value: `remove:${o.id}`,
		})),
		{ label: "Back", value: "__back__" },
	];

	return (
		<Box flexDirection="column" gap={1}>
			<TextLabel text="Owners" bold color="cyan" />
			{rows.length > 0 && <DataTable headers={["ID", "Name"]} rows={rows} />}
			{rows.length === 0 && <TextLabel text="No owners yet." dimColor />}
			<NavigationMenu
				title="Actions"
				options={menuOptions}
				onSelect={(value) => {
					if (value === "__back__") return onBack();
					if (value === "add") return setMode("add-id");
					if (value.startsWith("remove:")) {
						setRemoveId(value.replace("remove:", ""));
						setMode("remove");
					}
				}}
			/>
		</Box>
	);
}
