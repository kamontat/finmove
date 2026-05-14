import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";

export function CurrencyList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus } = useFocus();
	const { setHints, setColor, setTitleSuffix } = useLayout();
	const { setMenu, armed, setActiveIndex } = useMenu();
	const { goTo, goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Currencies");
		setColor({});
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const currencies = trip.settings.currencies;
		const entries = Object.entries(currencies);
		const hasItems = entries.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems
					? [
							{
								label: "Delete",
								value: "delete",
								key: "x",
								mainAction: {
									confirmCount: 2,
									onConfirm: (i: number) => {
										const entry = entries[i];
										if (!entry) return;
										const [code] = entry;
										const { [code]: _unused, ...rest } = currencies;
										updateSettings(trip.dirPath, { currencies: rest });
										reloadTrip();
										if (Object.keys(rest).length === 0) {
											goBack();
										}
									},
								},
							},
						]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/settings/currencies/new", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "delete" && hasItems) {
					goTo("/trips/settings/currencies/delete", {
						props: { tripDirPath, tripName },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		trip,
		reloadTrip,
		setMenu,
		setHints,
		setColor,
		setTitleSuffix,
		goTo,
		goBack,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { currencies } = trip.settings;
	const entries = Object.entries(currencies);

	if (entries.length === 0) {
		return <Text dimColor>No currencies yet.</Text>;
	}

	return (
		<ListSelect
			options={entries.map(([code, config]) => ({
				label: code,
				value: code,
				detail: `rate: ${config.exchangeRate}`,
			}))}
			onChange={(code) => {
				goTo("/trips/settings/currencies/edit", {
					props: {
						tripDirPath: trip.dirPath,
						tripName: trip.settings.name,
						currencyCode: code,
					},
				});
			}}
			onHighlight={(_, i) => setActiveIndex(i)}
			armedRowIndex={armed?.index ?? null}
			isActive={focus === "main"}
		/>
	);
}
