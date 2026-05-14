import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { validateTag } from "../../core/validators";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TagEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	const { value: originalValue } = useRouteProps("/trips/settings/tags/edit");

	useEffect(() => {
		setTitleSuffix(`Settings > Tags > ${originalValue}`);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, originalValue]);

	if (!trip) return <Text dimColor>Loading...</Text>;

	const originalTag = trip.settings.tags.find((t) => t.value === originalValue);
	if (!originalTag) return <Text dimColor>Tag not found.</Text>;

	const fields: FormFieldConfig[] = [
		{
			key: "value",
			label: "Tag",
			type: "text",
			required: true,
			defaultValue: originalTag.value,
		},
		{
			key: "default",
			label: "Default",
			type: "select",
			required: true,
			options: [
				{ label: "No", value: "false" },
				{ label: "Yes", value: "true" },
			],
			defaultValue: originalTag.default ? "true" : "false",
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const next = getString(values, "value").trim();
				const errors = validateTag(next, trip.settings.tags, originalValue);
				if (errors.length > 0) {
					throw new Error(errors[0]);
				}
				const isDefault = getString(values, "default") === "true";
				updateSettings(trip.dirPath, {
					tags: trip.settings.tags.map((t) =>
						t.value === originalValue ? { value: next, default: isDefault } : t,
					),
				});
				reloadTrip();
				goBack();
			}}
		/>
	);
}
