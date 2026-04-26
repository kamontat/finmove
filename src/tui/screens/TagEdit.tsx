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

	const fields: FormFieldConfig[] = [
		{
			key: "value",
			label: "Tag",
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
						tags: trip.settings.tags.map((t) =>
							t === originalValue ? next : t,
						),
					});
					reloadTrip();
				}
				goBack();
			}}
		/>
	);
}
