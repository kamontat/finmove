import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Category",
		type: "text",
		required: true,
		placeholder: "e.g. Flight",
	},
];

export function CategoryCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Categories > New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const value = values["value"]?.trim();
				if (value) {
					updateSettings(trip.dirPath, {
						categories: [...trip.settings.categories, value],
					});
					reloadTrip();
				}
				goBack();
			}}
		/>
	);
}
