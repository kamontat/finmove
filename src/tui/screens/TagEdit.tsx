import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { validateTag } from "../../core/validators";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getBoolean, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";
import { settingsTitle } from "../utils/titles";

export function TagEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitle, clearTitle } = useLayout();
	const { goBack } = useNavigation();

	const { value: originalValue } = useRouteProps("/trips/settings/tags/edit");

	useEffect(() => {
		setTitle(settingsTitle(trip, "Tags", originalValue));
		setHints(FORM_HINTS);
		return () => clearTitle();
	}, [setHints, setTitle, clearTitle, trip, originalValue]);

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
			type: "boolean",
			required: true,
			defaultValue: originalTag.default,
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
				const isDefault = getBoolean(values, "default");
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
