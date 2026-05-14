import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function TagList(): JSX.Element {
	const { trip } = useData();
	const { focus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Tags");
		setBorderColor(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const hasItems = trip.settings.tags.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems ? [{ label: "Delete", value: "delete", key: "x" }] : []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/settings/tags/new", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "delete" && hasItems) {
					goTo("/trips/settings/tags/delete", {
						props: { tripDirPath, tripName },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [trip, setMenu, setHints, setBorderColor, setTitleSuffix, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { tags } = trip.settings;

	if (tags.length === 0) {
		return <Text dimColor>No tags yet.</Text>;
	}

	return (
		<ListSelect
			options={tags.map((t) => ({ label: t, value: t }))}
			onChange={(value) => {
				goTo("/trips/settings/tags/edit", {
					props: {
						tripDirPath: trip.dirPath,
						tripName: trip.settings.name,
						value,
					},
				});
			}}
			isActive={focus === "main"}
		/>
	);
}
