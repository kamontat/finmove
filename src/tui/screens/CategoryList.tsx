import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function CategoryList(): JSX.Element {
	const { trip } = useData();
	const { focus } = useFocus();
	const { setMenu, setHints, setColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Categories");
		setColor({});
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const hasItems = trip.settings.categories.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems ? [{ label: "Delete", value: "delete", key: "x" }] : []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/settings/categories/new", {
						props: { tripDirPath, tripName },
					});
				} else if (value === "delete" && hasItems) {
					goTo("/trips/settings/categories/delete", {
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

	const { categories } = trip.settings;

	if (categories.length === 0) {
		return <Text dimColor>No categories yet.</Text>;
	}

	return (
		<ListSelect
			options={categories.map((c) => ({ label: c, value: c }))}
			onChange={(value) => {
				goTo("/trips/settings/categories/edit", {
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
