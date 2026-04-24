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
import { useNavigation } from "../states/navigation";

export function TripDuplicate(): JSX.Element {
	const { goBack, currentRoute } = useNavigation();
	const { setHints, setTitleSuffix } = useLayout();

	const dataDir =
		(currentRoute.props["dataDir"] as string | undefined) ?? "./data";
	const sourceDirPath = currentRoute.props["sourceDirPath"] as string;
	const sourceName = currentRoute.props["sourceName"] as string;
	const sourceStartDate = currentRoute.props["sourceStartDate"] as string;

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
					goBack();
				}}
			/>
		</Box>
	);
}
