import { Box } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";
import { useNotification } from "../states/notification";

const FIELDS: FormFieldConfig[] = [
	{
		key: "value",
		label: "Country",
		type: "text",
		required: true,
		placeholder: "e.g. Japan",
	},
];

export function TripCreateCountryAdd(): JSX.Element {
	const { goBack } = useNavigation();
	const { setHints, setTitle, clearTitle } = useLayout();
	const { formId = "trip-new" } = useRouteProps("/trips/new/countries/new");
	const { notify } = useNotification();

	const buffer = useFormBuffer(formId);
	const raw = buffer.values["countries"];
	const current = Array.isArray(raw) ? raw : [];

	useEffect(() => {
		setTitle(["Trips", "Countries", "New"]);
		setHints(FORM_HINTS);
		return () => clearTitle();
	}, [setHints, setTitle, clearTitle]);

	return (
		<Box flexDirection="column">
			<Form
				fields={FIELDS}
				onSubmit={(values) => {
					const value = getString(values, "value").trim();
					if (value === "") {
						notify("Country name cannot be empty.", "error", {
							persistent: true,
						});
						return;
					}
					if (current.includes(value)) {
						notify(`"${value}" is already in the list.`, "error", {
							persistent: true,
						});
						return;
					}
					buffer.setField("countries", [...current, value]);
					goBack();
				}}
			/>
		</Box>
	);
}
