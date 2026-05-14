import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function CurrencyDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setBorderColor("red");
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix("Settings > Currencies > Delete");
		return () => {
			setBorderColor(null);
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { currencies } = trip.settings;
	const entries = Object.entries(currencies);

	if (entries.length === 0) {
		return <Text dimColor>No currencies.</Text>;
	}

	return (
		<RemoveSelector
			header="Select a currency to delete:"
			options={entries.map(([code, config]) => ({
				label: code,
				value: code,
				detail: `rate: ${config.exchangeRate}`,
			}))}
			onConfirm={(value) => {
				const { [value]: _unused, ...rest } = currencies;
				updateSettings(trip.dirPath, { currencies: rest });
				reloadTrip();
				if (Object.keys(rest).length === 0) {
					goBack();
				}
			}}
		/>
	);
}
