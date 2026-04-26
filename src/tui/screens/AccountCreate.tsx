import type { JSX } from "react";
import { useEffect } from "react";
import type { AccountType } from "../../core/models";
import { addAccount } from "../../core/services/account";
import { uniqueSlug } from "../../core/services/slug";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FIELDS: FormFieldConfig[] = [
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

export function AccountCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix(null);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const name = values["name"] ?? "";
				const ownersStr = values["owners"] ?? "";
				const owners = ownersStr.split(",").map((s) => s.trim());
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
				goBack();
			}}
		/>
	);
}
