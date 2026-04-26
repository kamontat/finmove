import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { LIST_HINTS, SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type SelectMode = "remove";

export function CurrencyList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack, currentRoute } = useNavigation();

	const selectMode = currentRoute.props["selectMode"] as SelectMode | undefined;

	useEffect(() => {
		setTitleSuffix("Settings > Currencies");
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const hasItems = Object.keys(trip.settings.currencies).length > 0;

		if (selectMode === "remove") {
			setBorderColor("red");
			setMenu([], () => {});
			setHints(SELECT_REMOVE_HINTS);
			return;
		}

		setBorderColor(null);
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems ? [{ label: "Delete", value: "delete", key: "d" }] : []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/settings/currencies/new", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "delete" && hasItems) {
					goTo("/trips/settings/currencies", {
						props: { tripDirPath, tripName, selectMode: "remove" },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		trip,
		selectMode,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { currencies } = trip.settings;
	const entries = Object.entries(currencies);

	if (selectMode === "remove") {
		if (entries.length === 0) {
			return <Text dimColor>No currencies.</Text>;
		}
		return (
			<RemoveSelector
				header="Select a currency to remove:"
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
				onCancel={goBack}
			/>
		);
	}

	if (entries.length === 0) {
		return <Text dimColor>No currencies yet.</Text>;
	}

	return (
		<VerticalSelect
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
