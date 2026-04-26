import { existsSync } from "node:fs";
import { join } from "node:path";
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Settings } from "../../core/models";
import { addDays, today } from "../../core/services/date";
import { createTrip, toDirName } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const DEFAULT_SETTINGS: Omit<Settings, "name" | "startDate" | "endDate"> = {
	countries: [],
	baseCurrency: "THB",
	currencies: {},
	categories: [
		"Flight",
		"Hotels",
		"Transportation",
		"Shopping",
		"Eating",
		"Activities",
	],
	tags: [],
	exportPath: "./expenses.csv",
};

const FIELDS: FormFieldConfig[] = [
	{
		key: "name",
		label: "Trip Name",
		type: "text",
		required: true,
		placeholder: "e.g. Japan Trip",
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
];

export function TripCreate(): JSX.Element {
	const { goTo, currentRoute } = useNavigation();
	const { setHints, setTitleSuffix } = useLayout();

	const dataDir =
		(currentRoute.props["dataDir"] as string | undefined) ?? "./data";

	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setTitleSuffix(null);
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
					const name = values["name"] ?? "";
					const startDate = values["startDate"] ?? today();
					const endDate = values["endDate"] ?? addDays(today(), 1);
					const dirName = toDirName(name, startDate);
					const tripPath = join(dataDir, dirName);
					if (existsSync(tripPath)) {
						setError(`Trip "${name}" already exists (${dirName})`);
						return;
					}
					setError(null);
					const settings: Settings = {
						...DEFAULT_SETTINGS,
						name,
						startDate,
						endDate,
					};
					const newTrip = createTrip(dataDir, dirName, settings);
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
