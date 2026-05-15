import { existsSync } from "node:fs";
import { join } from "node:path";
import { Box } from "ink";
import type { JSX } from "react";
import { useEffect, useMemo } from "react";
import { DEFAULT_TRIP_SETTINGS } from "../../core/constants";
import type { Settings } from "../../core/models";
import { addDays, today } from "../../core/services/date";
import { isValidSlug } from "../../core/services/slug";
import {
	createTrip,
	duplicateTrip,
	loadTrip,
	toDirName,
} from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString, getStringArray } from "../models";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";
import { useNotification } from "../states/notification";

export function TripForm(): JSX.Element {
	const { goTo } = useNavigation();
	const { setHints, setTitle, clearTitle } = useLayout();

	const { dataDir = "./data", duplicateFromDirPath } =
		useRouteProps("/trips/new");

	const duplicateSource = useMemo(
		() => (duplicateFromDirPath ? loadTrip(duplicateFromDirPath) : null),
		[duplicateFromDirPath],
	);
	const isDuplicate = duplicateSource !== null;

	const formId = duplicateFromDirPath
		? `trip-duplicate-${duplicateFromDirPath}`
		: "trip-new";
	const buffer = useFormBuffer(formId);

	const { notify, dismiss } = useNotification();

	useEffect(() => {
		if (isDuplicate && duplicateSource) {
			setTitle(["Trips", "Duplicate", duplicateSource.settings.name]);
		} else {
			setTitle(["Trips", "New"]);
		}
		setHints(FORM_HINTS);
		return () => clearTitle();
	}, [isDuplicate, duplicateSource, setHints, setTitle, clearTitle]);

	useEffect(() => {
		if (!duplicateSource) return;
		if (buffer.values["countries"] === undefined) {
			buffer.setField("countries", duplicateSource.settings.countries);
		}
	}, [duplicateSource, buffer]);

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
			defaultValue: duplicateSource?.settings.startDate ?? today(),
		},
		{
			key: "endDate",
			label: "End Date",
			type: "date",
			required: true,
			defaultValue: duplicateSource?.settings.endDate ?? addDays(today(), 1),
		},
		{
			key: "countries",
			label: "Countries",
			type: "multiselect",
			required: false,
			onEdit: () =>
				goTo("/trips/new/countries", { props: { dataDir, formId } }),
		},
	];

	return (
		<Box flexDirection="column">
			<Form
				formId={formId}
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
						notify(
							`Directory name "${dirName}" is invalid. Use lowercase letters, digits, and hyphens.`,
							"error",
							{ persistent: true },
						);
						return;
					}

					const tripPath = join(dataDir, dirName);
					if (existsSync(tripPath)) {
						notify(`Trip directory "${dirName}" already exists`, "error", {
							persistent: true,
						});
						return;
					}
					dismiss();

					if (duplicateSource) {
						duplicateTrip(dataDir, duplicateSource.dirPath, dirName, {
							name,
							startDate,
							endDate,
							countries,
						});
						buffer.clear();
						goTo("/trips", { replace: true, props: { dataDir } });
						return;
					}

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
