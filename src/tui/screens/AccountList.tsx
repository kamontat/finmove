import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Trip } from "../../core/models";
import { AccountType } from "../../core/models";
import { addAccount, removeAccount } from "../../core/services/account";
import { SelectInput } from "../components/atoms/SelectInput";
import { TextLabel } from "../components/atoms/TextLabel";
import { FormField } from "../components/molecules/FormField";
import { DataTable } from "../components/organisms/DataTable";

interface AccountListProps {
	trip: Trip;
	onTripUpdated: () => void;
	pendingAction: string | null;
	onActionConsumed: () => void;
}

type Mode = "list" | "add-id" | "add-name" | "add-type" | "add-owners";

export function AccountList({
	trip,
	onTripUpdated,
	pendingAction,
	onActionConsumed,
}: AccountListProps): JSX.Element {
	const [mode, setMode] = useState<Mode>("list");
	const [newId, setNewId] = useState("");
	const [newName, setNewName] = useState("");
	const [newType, setNewType] = useState<AccountType>(AccountType.Credit);

	useEffect(() => {
		if (!pendingAction || mode !== "list") return;
		if (pendingAction === "add") {
			setMode("add-id");
		} else if (pendingAction.startsWith("remove:")) {
			removeAccount(trip, pendingAction.replace("remove:", ""));
			onTripUpdated();
		}
		onActionConsumed();
	}, [pendingAction, mode, onActionConsumed, trip, onTripUpdated]);

	if (mode === "add-id") {
		return (
			<FormField
				label="Account ID (slug):"
				placeholder="e.g. alice-credit"
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
				label="Account display name:"
				placeholder="e.g. Alice's Visa"
				onSubmit={(name) => {
					setNewName(name);
					setMode("add-type");
				}}
			/>
		);
	}

	if (mode === "add-type") {
		return (
			<Box flexDirection="column">
				<TextLabel text="Account type:" bold />
				<SelectInput
					options={[
						{ label: "Credit", value: "Credit", key: "c" },
						{ label: "Debit", value: "Debit", key: "d" },
					]}
					onChange={(value) => {
						setNewType(value as AccountType);
						setMode("add-owners");
					}}
				/>
			</Box>
		);
	}

	if (mode === "add-owners") {
		return (
			<FormField
				label="Owner IDs (comma-separated):"
				placeholder="e.g. alice,bob"
				onSubmit={(ownersStr) => {
					const owners = ownersStr.split(",").map((s) => s.trim());
					addAccount(trip, {
						id: newId,
						name: newName,
						type: newType,
						owners,
					});
					onTripUpdated();
					setMode("list");
				}}
			/>
		);
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
