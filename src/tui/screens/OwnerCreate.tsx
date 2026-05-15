import type { JSX } from "react";
import { useEffect } from "react";
import { addOwner } from "../../core/services/owner";
import { isValidSlug, uniqueSlug } from "../../core/services/slug";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";
import { tripTitle } from "../utils/titles";

export function OwnerCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitle, clearTitle } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitle(tripTitle(trip, "Owners", "New"));
		setHints(FORM_HINTS);
		return () => clearTitle();
	}, [setHints, setTitle, clearTitle, trip]);

	if (!trip) return null;

	const takenIds = trip.owners.map((o) => o.id);

	const fields: FormFieldConfig[] = [
		{
			key: "name",
			label: "Display name",
			type: "text",
			required: true,
			placeholder: "e.g. Alice",
		},
		{
			key: "id",
			label: "ID",
			type: "text",
			required: false,
			placeholder: (values) => {
				const name = values["name"] ?? "";
				if (name === "") return "auto-generate from name";
				return uniqueSlug(name, takenIds);
			},
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const name = getString(values, "name");
				const explicitId = getString(values, "id").trim();
				const id = explicitId === "" ? uniqueSlug(name, takenIds) : explicitId;

				if (!isValidSlug(id)) {
					throw new Error(
						`ID "${id}" is invalid. Use lowercase letters, digits, and hyphens.`,
					);
				}
				if (takenIds.includes(id)) {
					throw new Error(`Owner ID "${id}" already exists.`);
				}

				addOwner(trip, { id, name });
				reloadTrip();
				goBack();
			}}
		/>
	);
}
