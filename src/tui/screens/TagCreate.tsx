import type { JSX } from "react";
import { useEffect } from "react";
import { validateTag } from "../../core/validators";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Tag",
		type: "text",
		required: true,
		placeholder: "e.g. business",
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
		defaultValue: "false",
	},
];

export function TagCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Tags > New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const value = getString(values, "value").trim();
				const errors = validateTag(value, trip.settings.tags);
				if (errors.length > 0) {
					throw new Error(errors[0]);
				}
				const isDefault = getString(values, "default") === "true";
				updateSettings(trip.dirPath, {
					tags: [...trip.settings.tags, { value, default: isDefault }],
				});
				reloadTrip();
				goBack();
			}}
		/>
	);
}
