import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import type { CurrencyConfig } from "../../core/models";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function CurrencyEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	const { currencyCode: code } = useRouteProps(
		"/trips/settings/currencies/edit",
	);

	useEffect(() => {
		setTitleSuffix(`Settings > Currencies > ${code}`);
		setHints(FORM_HINTS);
	}, [setHints, setTitleSuffix, code]);

	if (!trip) return <Text dimColor>Loading...</Text>;

	const existing = trip.settings.currencies[code];
	if (!existing) {
		return <Text dimColor>Currency "{code}" not found.</Text>;
	}

	const fields: FormFieldConfig[] = [
		{
			key: "exchangeRate",
			label: `Exchange Rate for ${code}`,
			type: "text",
			required: true,
			defaultValue: String(existing.exchangeRate),
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const rate = Number.parseFloat(values["exchangeRate"] ?? "");
				if (!Number.isNaN(rate)) {
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
