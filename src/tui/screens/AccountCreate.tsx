import type { JSX } from "react";
import { useEffect } from "react";
import type { AccountType } from "../../core/models";
import { addAccount } from "../../core/services/account";
import { isValidSlug, uniqueSlug } from "../../core/services/slug";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString, getStringArray } from "../models";
import { useData } from "../states/data";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FORM_ID = "account-new";

export function AccountCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goTo, goBack } = useNavigation();
	const buffer = useFormBuffer(FORM_ID);

	useEffect(() => {
		setTitleSuffix(null);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	const tripDirPath = trip.dirPath;
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
			label: "Owners",
			type: "multiselect",
			required: true,
			onEdit: () =>
				goTo("/trips/accounts/new/owners", {
					props: { tripDirPath, formId: FORM_ID, fieldKey: "owners" },
				}),
		},
	];

	return (
		<Form
			formId={FORM_ID}
			fields={fields}
			onSubmit={(values) => {
				const name = getString(values, "name");
				const explicitId = getString(values, "id").trim();
				const id = explicitId === "" ? uniqueSlug(name, takenIds) : explicitId;

				if (!isValidSlug(id)) {
					throw new Error(
						`ID "${id}" is invalid. Use lowercase letters, digits, and hyphens.`,
					);
				}
				if (takenIds.includes(id)) {
					throw new Error(`Account ID "${id}" already exists.`);
				}

				const owners = getStringArray(values, "owners");

				addAccount(trip, {
					id,
					name,
					type: (getString(values, "type") || "Credit") as AccountType,
					owners,
				});
				reloadTrip();
				buffer.clear();
				goBack();
			}}
		/>
	);
}
