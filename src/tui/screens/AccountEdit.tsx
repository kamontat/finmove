import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import type { AccountType } from "../../core/models";
import { updateAccount } from "../../core/services/account";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString, getStringArray } from "../models";
import { useData } from "../states/data";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function AccountEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goTo, goBack } = useNavigation();

	const { accountId } = useRouteProps("/trips/accounts/edit");
	const account = trip?.accounts.find((a) => a.id === accountId);

	const formId = `account-edit-${accountId}`;
	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setTitleSuffix(account?.name ?? accountId);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, account, accountId]);

	// Seed the buffer with the account's current owners on first mount, so the
	// OwnerSelect sub-page opens with the correct initial selection.
	useEffect(() => {
		if (account && buffer.values["owners"] === undefined) {
			buffer.setField("owners", account.owners);
		}
	}, [account, buffer]);

	if (!trip) return <Text dimColor>Loading...</Text>;
	if (!account) return <Text dimColor>Account "{accountId}" not found.</Text>;

	const tripDirPath = trip.dirPath;

	const fields: FormFieldConfig[] = [
		{
			key: "name",
			label: "Display name",
			type: "text",
			required: true,
			placeholder: "e.g. Alice's Visa",
			defaultValue: account.name,
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
			defaultValue: account.type,
		},
		{
			key: "owners",
			label: "Owners",
			type: "multiselect",
			required: true,
			defaultValue: account.owners,
			onEdit: () =>
				goTo("/trips/accounts/edit/owners", {
					props: {
						tripDirPath,
						accountId,
						formId,
						fieldKey: "owners",
					},
				}),
		},
	];

	return (
		<Box flexDirection="column">
			<Text dimColor>ID: {account.id}</Text>
			<Form
				formId={formId}
				fields={fields}
				onSubmit={(values) => {
					const name = getString(values, "name") || account.name;
					const typeStr = getString(values, "type") || account.type;
					const owners = getStringArray(values, "owners");
					updateAccount(trip, account.id, {
						name,
						type: typeStr as AccountType,
						owners,
					});
					reloadTrip();
					buffer.clear();
					goBack();
				}}
			/>
		</Box>
	);
}
