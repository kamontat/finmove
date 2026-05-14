import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";

export function CurrencyList(): JSX.Element {
	const { trip } = useData();
	const { focus } = useFocus();
	const { setHints, setColor, setTitleSuffix } = useLayout();
	const { setMenu } = useMenu();
	const { goTo } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Currencies");
		setColor({});
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const hasItems = Object.keys(trip.settings.currencies).length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems ? [{ label: "Delete", value: "delete", key: "x" }] : []),
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
	}, [trip, setMenu, setHints, setColor, setTitleSuffix, goTo]);

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
			isActive={focus === "main"}
		/>
	);
}
