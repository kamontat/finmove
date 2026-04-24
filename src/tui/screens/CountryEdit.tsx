import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function CountryEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack, currentRoute } = useNavigation();

	const originalValue = currentRoute.props["value"] as string;

	useEffect(() => {
		setTitleSuffix(`Settings > Countries > ${originalValue}`);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, originalValue]);

	if (!trip) return <Text dimColor>Loading...</Text>;

	const fields: FormFieldConfig[] = [
		{
			key: "value",
			label: "Country",
			type: "text",
			required: true,
			defaultValue: originalValue,
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const next = values["value"]?.trim();
				if (next) {
					updateSettings(trip.dirPath, {
						countries: trip.settings.countries.map((c) =>
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
