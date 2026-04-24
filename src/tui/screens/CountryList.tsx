import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { LIST_HINTS, SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

type SelectMode = "remove";

export function CountryList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack, currentRoute } = useNavigation();

	const selectMode = currentRoute.props["selectMode"] as SelectMode | undefined;

	useEffect(() => {
		setTitleSuffix("Settings > Countries");
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const hasItems = trip.settings.countries.length > 0;

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
					goTo("/trips/settings/countries/new", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "delete" && hasItems) {
					goTo("/trips/settings/countries", {
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

	const { countries } = trip.settings;

	if (selectMode === "remove") {
		if (countries.length === 0) {
			return <Text dimColor>No countries.</Text>;
		}
		return (
			<RemoveSelector
				header="Select a country to remove:"
				options={countries.map((c) => ({ label: c, value: c }))}
				onConfirm={(value) => {
					const remaining = countries.filter((c) => c !== value);
					updateSettings(trip.dirPath, { countries: remaining });
					reloadTrip();
					if (remaining.length === 0) {
						goBack();
					}
				}}
				onCancel={goBack}
			/>
		);
	}

	if (countries.length === 0) {
		return <Text dimColor>No countries yet.</Text>;
	}

	return (
		<VerticalSelect
			options={countries.map((c) => ({ label: c, value: c }))}
			onChange={(value) => {
				goTo("/trips/settings/countries/edit", {
					props: {
						tripDirPath: trip.dirPath,
						tripName: trip.settings.name,
						value,
					},
				});
			}}
			isActive
		/>
	);
}
