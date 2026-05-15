import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
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

	const fields: FormFieldConfig[] = [
		{
			key: "value",
			label: "Category",
			type: "text",
			required: true,
			defaultValue: originalValue,
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const next = getString(values, "value").trim();
				if (next) {
					updateSettings(trip.dirPath, {
						categories: trip.settings.categories.map((c) =>
							c === originalValue ? next : c,
						),
					});
					reloadTrip();
				}
				goBack();
			}}
		/>
	);
}
