import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { settingsTitle } from "../utils/titles";

export function CurrencyDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();
	const { goBack } = useNavigation();

	useEffect(() => {
		setColor({ border: "red", title: "red" });
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitle(settingsTitle(trip, "Currencies", "Delete"));
		return () => {
			setColor({});
			clearTitle();
		};
	}, [setColor, setMenu, setHints, setTitle, clearTitle, trip]);

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
			options={entries.map(([code, config]) => ({
				label: code,
				value: code,
				detail:
					config.exchangeRate !== undefined
						? `rate: ${config.exchangeRate}`
						: "rate: (not set)",
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
