import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { validateTag } from "../../core/validators";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getBoolean, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";
import { settingsTitle } from "../utils/titles";

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
		type: "boolean",
		required: true,
		defaultValue: false,
	},
];

export function TagCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitle, clearTitle } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitle(settingsTitle(trip, "Tags", "New"));
		setHints(FORM_HINTS);
		return () => clearTitle();
	}, [setHints, setTitle, clearTitle, trip]);

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
				const isDefault = getBoolean(values, "default");
				updateSettings(trip.dirPath, {
					tags: [...trip.settings.tags, { value, default: isDefault }],
				});
				reloadTrip();
				goBack();
			}}
		/>
	);
}
