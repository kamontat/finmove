import type { JSX } from "react";
import { useEffect } from "react";
import type { AccountType } from "../../core/models";
import { addAccount } from "../../core/services/account";
import { isValidSlug, uniqueSlug } from "../../core/services/slug";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function AccountCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix(null);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	const takenIds = trip.accounts.map((a) => a.id);

	const fields: FormFieldConfig[] = [
		{
			key: "name",
			label: "Display name",
			type: "text",
			required: true,
			placeholder: "e.g. Alice's Visa",
		},
		{
			key: "id",
			label: "ID",
			type: "text",
			required: false,
			placeholder: (values) => {
				const name = values["name"] ?? "";
				if (name === "") return "auto-generate from name";
				return uniqueSlug(name, takenIds);
			},
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

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const name = values["name"] ?? "";
				const explicitId = (values["id"] ?? "").trim();
				const id = explicitId === "" ? uniqueSlug(name, takenIds) : explicitId;

				if (!isValidSlug(id)) {
					throw new Error(
						`ID "${id}" is invalid. Use lowercase letters, digits, and hyphens.`,
					);
				}
				if (takenIds.includes(id)) {
					throw new Error(`Account ID "${id}" already exists.`);
				}

				const ownersStr = values["owners"] ?? "";
				const owners = ownersStr.split(",").map((s) => s.trim());

				addAccount(trip, {
					id,
					name,
					type: (values["type"] ?? "Credit") as AccountType,
					owners,
				});
				reloadTrip();
				goBack();
			}}
		/>
	);
}
