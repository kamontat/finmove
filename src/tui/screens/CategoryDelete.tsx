import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function CategoryDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setColor, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setColor({ border: "red", title: "red" });
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix("Settings > Categories > Delete");
		return () => {
			setColor({});
			setTitleSuffix(null);
		};
	}, [setColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { categories } = trip.settings;

	if (categories.length === 0) {
		return <Text dimColor>No categories.</Text>;
	}

	return (
		<RemoveSelector
			header="Select a category to delete:"
			options={categories.map((c) => ({ label: c, value: c }))}
			onConfirm={(value) => {
				const remaining = categories.filter((c) => c !== value);
				updateSettings(trip.dirPath, { categories: remaining });
				reloadTrip();
				if (remaining.length === 0) {
					goBack();
				}
			}}
		/>
	);
}
