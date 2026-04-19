import { Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Trip } from "../../core/models";
import { addOwner, removeOwner } from "../../core/services/owner";
import { ConfirmPrompt } from "../components/molecules/ConfirmPrompt";
import { FormField } from "../components/molecules/FormField";
import { DataTable } from "../components/organisms/DataTable";

interface OwnerListProps {
	trip: Trip;
	onTripUpdated: () => void;
	pendingAction: string | null;
	onActionConsumed: () => void;
}

type Mode = "list" | "add-id" | "add-name" | "remove";

export function OwnerList({
	trip,
	onTripUpdated,
	pendingAction,
	onActionConsumed,
}: OwnerListProps): JSX.Element {
	const [mode, setMode] = useState<Mode>("list");
	const [newId, setNewId] = useState("");
	const [removeId, setRemoveId] = useState<string | null>(null);

	useEffect(() => {
		if (!pendingAction || mode !== "list") return;
		if (pendingAction === "add") {
			setMode("add-id");
		} else if (pendingAction.startsWith("remove:")) {
			setRemoveId(pendingAction.replace("remove:", ""));
			setMode("remove");
		}
		onActionConsumed();
	}, [pendingAction, mode, onActionConsumed]);

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
