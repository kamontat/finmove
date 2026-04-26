import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import type { AccountType } from "../../core/models";
import { updateAccount } from "../../core/services/account";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function AccountEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	const { accountId } = useRouteProps("/trips/accounts/edit");
	const account = trip?.accounts.find((a) => a.id === accountId);

	useEffect(() => {
		setTitleSuffix(account?.name ?? accountId);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, account, accountId]);

	if (!trip) return <Text dimColor>Loading...</Text>;
	if (!account) return <Text dimColor>Account "{accountId}" not found.</Text>;

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
			label: "Owner IDs (comma-separated)",
			type: "text",
			required: true,
			placeholder: "e.g. alice,bob",
			defaultValue: account.owners.join(", "),
		},
	];

	return (
		<Box flexDirection="column">
			<Text dimColor>ID: {account.id}</Text>
			<Form
				fields={fields}
				onSubmit={(values) => {
					const name = getString(values, "name") || account.name;
					const typeStr = getString(values, "type") || account.type;
					const ownersStr =
						getString(values, "owners") || account.owners.join(", ");
					const owners = ownersStr.split(",").map((s) => s.trim());
					updateAccount(trip, account.id, {
						name,
						type: typeStr as AccountType,
						owners,
					});
					reloadTrip();
					goBack();
				}}
			/>
		</Box>
	);
}
