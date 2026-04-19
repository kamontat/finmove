import { Box } from "ink";
import type { JSX } from "react";
import { useState } from "react";
import type { Trip } from "../../core/models";
import { AccountType } from "../../core/models";
import { addAccount, removeAccount } from "../../core/services/account";
import { SelectInput } from "../components/atoms/select-input";
import { TextLabel } from "../components/atoms/text-label";
import { FormField } from "../components/molecules/form-field";
import { DataTable } from "../components/organisms/data-table";
import { NavigationMenu } from "../components/organisms/navigation-menu";

interface AccountListProps {
	trip: Trip;
	onBack: () => void;
	onTripUpdated: () => void;
}

type Mode = "list" | "add-id" | "add-name" | "add-type" | "add-owners";

export function AccountList({
	trip,
	onBack,
	onTripUpdated,
}: AccountListProps): JSX.Element {
	const [mode, setMode] = useState<Mode>("list");
	const [newId, setNewId] = useState("");
	const [newName, setNewName] = useState("");
	const [newType, setNewType] = useState<AccountType>(AccountType.Credit);

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
						{ label: "Credit", value: "Credit" },
						{ label: "Debit", value: "Debit" },
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
					addAccount(trip, { id: newId, name: newName, type: newType, owners });
					onTripUpdated();
					setMode("list");
				}}
			/>
		);
	}

	const rows = trip.accounts.map((a) => [
		a.id,
		a.name,
		a.type,
		a.owners.join(", "),
	]);

	const menuOptions = [
		{ label: "Add account", value: "add" },
		...trip.accounts.map((a) => ({
			label: `Remove ${a.name}`,
			value: `remove:${a.id}`,
		})),
		{ label: "Back", value: "__back__" },
	];

	return (
		<Box flexDirection="column" gap={1}>
			<TextLabel text="Accounts" bold color="cyan" />
			{rows.length > 0 && (
				<DataTable headers={["ID", "Name", "Type", "Owners"]} rows={rows} />
			)}
			{rows.length === 0 && <TextLabel text="No accounts yet." dimColor />}
			<NavigationMenu
				title="Actions"
				options={menuOptions}
				onSelect={(value) => {
					if (value === "__back__") return onBack();
					if (value === "add") return setMode("add-id");
					if (value.startsWith("remove:")) {
						removeAccount(trip, value.replace("remove:", ""));
						onTripUpdated();
					}
				}}
			/>
		</Box>
	);
}
