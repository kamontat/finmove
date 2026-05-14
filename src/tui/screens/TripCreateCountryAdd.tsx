import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

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
	const { setHints, setTitleSuffix } = useLayout();
	const { formId = "trip-new" } = useRouteProps("/trips/new/countries/new");

	const buffer = useFormBuffer(formId);
	const raw = buffer.values["countries"];
	const current = Array.isArray(raw) ? raw : [];

	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setTitleSuffix("Countries > New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	return (
		<Box flexDirection="column">
			{error && (
				<Text color="red" bold>
					{error}
				</Text>
			)}
			<Form
				fields={FIELDS}
				onSubmit={(values) => {
					const value = getString(values, "value").trim();
					if (value === "") {
						setError("Country name cannot be empty.");
						return;
					}
					if (current.includes(value)) {
						setError(`"${value}" is already in the list.`);
						return;
					}
					buffer.setField("countries", [...current, value]);
					goBack();
				}}
			/>
		</Box>
	);
}
