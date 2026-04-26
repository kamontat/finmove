import { existsSync } from "node:fs";
import { join } from "node:path";
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { duplicateTrip, toDirName } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripDuplicate(): JSX.Element {
	const { goBack } = useNavigation();
	const { setHints, setTitleSuffix } = useLayout();

	const {
		dataDir = "./data",
		sourceDirPath,
		sourceName,
		sourceStartDate,
	} = useRouteProps("/trips/duplicate");

	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setTitleSuffix(`Duplicate: ${sourceName}`);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, sourceName]);

	const fields: FormFieldConfig[] = [
		{
			key: "newName",
			label: "New Trip Name",
			type: "text",
			required: true,
			placeholder: `e.g. ${sourceName} v2`,
		},
	];

	return (
		<Box flexDirection="column">
			{error && (
				<Text color="red" bold>
					{error}
				</Text>
			)}
			<Form
				fields={fields}
				onSubmit={(values) => {
					const name = values["newName"] ?? "";
					const dirName = toDirName(name, sourceStartDate);
					const tripPath = join(dataDir, dirName);
					if (existsSync(tripPath)) {
						setError(`Trip "${name}" already exists (${dirName})`);
						return;
					}
					setError(null);
					duplicateTrip(dataDir, sourceDirPath, dirName, name);
					// Pop the form AND the duplicate-selector entry so the user
					// lands back on the normal trip list after a successful duplicate.
					goBack();
					goBack();
				}}
			/>
		</Box>
	);
}
