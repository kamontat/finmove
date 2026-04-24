import type { JSX } from "react";
import { useEffect } from "react";
import type { CurrencyConfig } from "../../core/models";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

const FIELDS: FormFieldConfig[] = [
	{
		key: "code",
		label: "Currency Code",
		type: "text",
		required: true,
		placeholder: "e.g. JPY",
	},
	{
		key: "exchangeRate",
		label: "Exchange Rate (to THB)",
		type: "text",
		required: true,
		placeholder: "e.g. 0.23",
	},
];

export function CurrencyCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Currencies > New");
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const code = values["code"]?.trim().toUpperCase();
				const rate = Number.parseFloat(values["exchangeRate"] ?? "");
				if (code && !Number.isNaN(rate)) {
					const updated: Record<string, CurrencyConfig> = {
						...trip.settings.currencies,
						[code]: { exchangeRate: rate },
					};
					updateSettings(trip.dirPath, { currencies: updated });
					reloadTrip();
				}
				goBack();
			}}
		/>
	);
}
