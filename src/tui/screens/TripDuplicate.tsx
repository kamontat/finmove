import { existsSync } from "node:fs";
import { join } from "node:path";
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { ZVENT_ID_PATTERN, ZVENT_TAG_REGEX } from "../../core/constants";
import {
	buildZventTag,
	duplicateTrip,
	nextZventId,
	toDirName,
	updateSettings,
} from "../../core/services/trip";
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
		{
			key: "zventId",
			label: "Zvent ID (3 digits, blank for auto)",
			type: "text",
			required: false,
			placeholder: () => nextZventId(dataDir),
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

					const rawZventId = (values["zventId"] ?? "").trim();
					let zventId: string;
					if (rawZventId === "") {
						zventId = nextZventId(dataDir);
					} else if (ZVENT_ID_PATTERN.test(rawZventId)) {
						zventId = rawZventId;
					} else {
						setError(`Zvent ID "${rawZventId}" must be exactly 3 digits.`);
						return;
					}

					const dirName = toDirName(name, sourceStartDate);
					const tripPath = join(dataDir, dirName);
					if (existsSync(tripPath)) {
						setError(`Trip "${name}" already exists (${dirName})`);
						return;
					}
					setError(null);

					const newTrip = duplicateTrip(dataDir, sourceDirPath, dirName, name);
					const tagsWithoutOldZvent = newTrip.settings.tags.filter(
						(t) => !ZVENT_TAG_REGEX.test(t),
					);
					const newZventTag = buildZventTag(
						zventId,
						name,
						newTrip.settings.endDate,
					);
					updateSettings(newTrip.dirPath, {
						tags: [newZventTag, ...tagsWithoutOldZvent],
					});

					// Pop the form AND the duplicate-selector entry so the user
					// lands back on the normal trip list after a successful duplicate.
					goBack();
					goBack();
				}}
			/>
		</Box>
	);
}
