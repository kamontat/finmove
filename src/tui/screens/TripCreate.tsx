import { existsSync } from "node:fs";
import { join } from "node:path";
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { DEFAULT_TRIP_SETTINGS } from "../../core/constants";
import type { Settings } from "../../core/models";
import { addDays, today } from "../../core/services/date";
import { isValidSlug } from "../../core/services/slug";
import { createTrip, toDirName } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString, getStringArray } from "../models";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

const FORM_ID = "trip-new";

export function TripCreate(): JSX.Element {
	const { goTo } = useNavigation();
	const { setHints, setTitleSuffix } = useLayout();
	const buffer = useFormBuffer(FORM_ID);

	const { dataDir = "./data" } = useRouteProps("/trips/new");

	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setTitleSuffix(null);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	const fields: FormFieldConfig[] = [
		{
			key: "name",
			label: "Trip Name",
			type: "text",
			required: true,
			placeholder: "e.g. Japan Trip",
		},
		{
			key: "dirName",
			label: "Directory Name",
			type: "text",
			required: false,
			placeholder: (values) => {
				const name = values["name"] ?? "";
				const startDate = values["startDate"] ?? today();
				if (name === "") return "auto-generate from name + start year";
				return toDirName(name, startDate);
			},
		},
		{
			key: "startDate",
			label: "Start Date",
			type: "date",
			required: true,
			defaultValue: today(),
		},
		{
			key: "endDate",
			label: "End Date",
			type: "date",
			required: true,
			defaultValue: addDays(today(), 1),
		},
		{
			key: "countries",
			label: "Countries",
			type: "multiselect",
			required: false,
			onEdit: () => goTo("/trips/new/countries", { props: { dataDir } }),
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
				formId={FORM_ID}
				fields={fields}
				onSubmit={(values) => {
					const name = getString(values, "name");
					const startDate = getString(values, "startDate") || today();
					const endDate = getString(values, "endDate") || addDays(today(), 1);
					const explicitDirName = getString(values, "dirName").trim();
					const dirName =
						explicitDirName === ""
							? toDirName(name, startDate)
							: explicitDirName;

					const countries = getStringArray(values, "countries");

					if (!isValidSlug(dirName)) {
						setError(
							`Directory name "${dirName}" is invalid. Use lowercase letters, digits, and hyphens.`,
						);
						return;
					}

					const tripPath = join(dataDir, dirName);
					if (existsSync(tripPath)) {
						setError(`Trip directory "${dirName}" already exists`);
						return;
					}
					setError(null);
					const settings: Settings = {
						...DEFAULT_TRIP_SETTINGS,
						name,
						startDate,
						endDate,
						countries,
					};
					const newTrip = createTrip(dataDir, dirName, settings);
					buffer.clear();
					goTo("/trips/overview", {
						replace: true,
						props: {
							tripDirPath: newTrip.dirPath,
							tripName: name,
							dataDir,
						},
					});
				}}
			/>
		</Box>
	);
}
