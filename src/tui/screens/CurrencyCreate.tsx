import type { JSX } from "react";
import { useEffect } from "react";
import type { CurrencyConfig } from "../../core/models";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getNumber, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";
import { settingsTitle } from "../utils/titles";

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
		type: "number",
		required: false,
		placeholder: "e.g. 0.23",
	},
];

export function CurrencyCreate(): JSX.Element | null {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitle, clearTitle } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setTitle(settingsTitle(trip, "Currencies", "New"));
		setHints(FORM_HINTS);
		return () => clearTitle();
	}, [setHints, setTitle, clearTitle, trip]);

	if (!trip) return null;

	return (
		<Form
			fields={FIELDS}
			onSubmit={(values) => {
				const code = getString(values, "code").trim().toUpperCase();
				if (!code) {
					goBack();
					return;
				}
				const rate = getNumber(values, "exchangeRate");
				const config: CurrencyConfig =
					rate !== undefined ? { exchangeRate: rate } : {};
				const updated: Record<string, CurrencyConfig> = {
					...trip.settings.currencies,
					[code]: config,
				};
				updateSettings(trip.dirPath, { currencies: updated });
				reloadTrip();
				goBack();
			}}
		/>
	);
}
