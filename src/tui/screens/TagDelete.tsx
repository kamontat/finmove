import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { updateSettings } from "../../core/services/trip";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function TagDelete(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	useEffect(() => {
		setBorderColor("red");
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix("Settings > Tags > Delete");
		return () => {
			setBorderColor(null);
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { tags } = trip.settings;

	if (tags.length === 0) {
		return <Text dimColor>No tags.</Text>;
	}

	return (
		<RemoveSelector
			header="Select a tag to delete:"
			options={tags.map((t) => ({ label: t, value: t }))}
			onConfirm={(value) => {
				const remaining = tags.filter((t) => t !== value);
				updateSettings(trip.dirPath, { tags: remaining });
				reloadTrip();
				if (remaining.length === 0) {
					goBack();
				}
			}}
		/>
	);
}
