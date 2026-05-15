import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import type { CurrencyConfig } from "../../core/models";
import { findCurrencyReferences } from "../../core/services/currency";
import { updateSettings } from "../../core/services/trip";
import { Form } from "../components/organisms/Form";
import { FORM_HINTS } from "../constants/hints";
import { type FormFieldConfig, getString } from "../models";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";
import { settingsTitle } from "../utils/titles";

export function CurrencyEdit(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setTitle, clearTitle } = useLayout();
	const { goBack } = useNavigation();

	const { currencyCode: code } = useRouteProps(
		"/trips/settings/currencies/edit",
	);

	useEffect(() => {
		setTitle(settingsTitle(trip, "Currencies", code));
		setHints(FORM_HINTS);
		return () => clearTitle();
	}, [setHints, setTitle, clearTitle, trip, code]);

	if (!trip) return <Text dimColor>Loading...</Text>;

	const existing = trip.settings.currencies[code];
	if (!existing) {
		return <Text dimColor>Currency "{code}" not found.</Text>;
	}

	const fields: FormFieldConfig[] = [
		{
			key: "code",
			label: "Currency Code",
			type: "text",
			required: true,
			defaultValue: code,
		},
		{
			key: "exchangeRate",
			label: `Exchange Rate for ${code}`,
			type: "text",
			required: false,
			...(existing.exchangeRate !== undefined
				? { defaultValue: String(existing.exchangeRate) }
				: {}),
		},
	];

	return (
		<Form
			fields={fields}
			onSubmit={(values) => {
				const newCode = getString(values, "code").trim().toUpperCase();
				if (!newCode) {
					throw new Error("Currency code is required");
				}

				const rateStr = getString(values, "exchangeRate").trim();
				const rate = rateStr === "" ? Number.NaN : Number.parseFloat(rateStr);
				const config: CurrencyConfig = Number.isFinite(rate)
					? { exchangeRate: rate }
					: {};

				if (newCode === code) {
					const updated: Record<string, CurrencyConfig> = {
						...trip.settings.currencies,
						[code]: config,
					};
					updateSettings(trip.dirPath, { currencies: updated });
					reloadTrip();
					goBack();
					return;
				}

				if (trip.settings.currencies[newCode] !== undefined) {
					throw new Error(`Currency '${newCode}' already exists`);
				}

				const refs = findCurrencyReferences(trip, code);
				if (refs.expenses.length > 0) {
					throw new Error(
						`Cannot rename: ${refs.expenses.length} expense(s) reference '${code}'`,
					);
				}

				const { [code]: _removed, ...rest } = trip.settings.currencies;
				const updated: Record<string, CurrencyConfig> = {
					...rest,
					[newCode]: config,
				};
				updateSettings(trip.dirPath, { currencies: updated });
				reloadTrip();
				goBack();
			}}
		/>
	);
}
