import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateOwner } from "../../core/services/owner";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function OwnerEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	const { ownerId } = useRouteProps("/trips/owners/edit");
	const owner = trip?.owners.find((o) => o.id === ownerId);

	useEffect(() => {
		setTitleSuffix(owner?.name ?? ownerId);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, owner, ownerId]);

	if (!trip) return <Text dimColor>Loading...</Text>;
	if (!owner) return <Text dimColor>Owner "{ownerId}" not found.</Text>;

	const fields: FormFieldConfig[] = [
		{
			key: "name",
			label: "Display name",
			type: "text",
			required: true,
			placeholder: "e.g. Alice",
			defaultValue: owner.name,
		},
	];

	return (
		<Box flexDirection="column">
			<Text dimColor>ID: {owner.id}</Text>
			<Form
				fields={fields}
				onSubmit={(values) => {
					const name = getString(values, "name") || owner.name;
					updateOwner(trip, owner.id, name);
					reloadTrip();
					goBack();
				}}
			/>
		</Box>
	);
}
