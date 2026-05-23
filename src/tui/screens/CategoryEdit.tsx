import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { validateCategory } from "../../core/validators";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getBoolean, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";
import { settingsTitle } from "../utils/titles";

export function CategoryEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitle, clearTitle } = useLayout();
	const { goBack } = useNavigation();

	const { value: originalValue } = useRouteProps(
		"/trips/settings/categories/edit",
	);

	useEffect(() => {
		setTitle(settingsTitle(trip, "Categories", originalValue));
		setHints(FORM_HINTS);
		return () => clearTitle();
	}, [setHints, setTitle, clearTitle, trip, originalValue]);

	if (!trip) return <Text dimColor>Loading...</Text>;

	const original = trip.settings.categories.find(
		(c) => c.value === originalValue,
	);
	if (!original) return <Text dimColor>Category not found.</Text>;

	const fields: FormFieldConfig[] = [
		{
			key: "value",
			label: "Category",
			type: "text",
			required: true,
			defaultValue: original.value,
		},
		{
			key: "excluded",
			label: "Exclude from total",
			type: "boolean",
			required: true,
			defaultValue: original.excluded,
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const next = getString(values, "value").trim();
				const errors = validateCategory(
					next,
					trip.settings.categories,
					originalValue,
				);
				if (errors.length > 0) {
					throw new Error(errors[0]);
				}
				const excluded = getBoolean(values, "excluded");
				updateSettings(trip.dirPath, {
					categories: trip.settings.categories.map((c) =>
						c.value === originalValue ? { value: next, excluded } : c,
					),
				});
				reloadTrip();
				goBack();
			}}
		/>
	);
}
