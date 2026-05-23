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
import { settingsTitle } from "../utils/titles";

export function CategoryList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus } = useFocus();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu, armed, setActiveIndex } = useMenu();
	const { goTo, goBack } = useNavigation();

	useEffect(() => {
		setTitle(settingsTitle(trip, "Categories"));
		return () => clearTitle();
	}, [setTitle, clearTitle, trip]);

	useEffect(() => {
		setColor({});
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const categories = trip.settings.categories;
		const hasItems = categories.length > 0;

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
										const target = categories[i];
										if (target === undefined) return;
										const remaining = categories.filter(
											(c) => c.value !== target.value,
										);
										updateSettings(trip.dirPath, { categories: remaining });
										reloadTrip();
										if (remaining.length === 0) {
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
	}, [trip, reloadTrip, setMenu, setHints, setColor, goTo, goBack]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { categories } = trip.settings;

	if (categories.length === 0) {
		return <Text dimColor>No categories yet.</Text>;
	}

	return (
		<ListSelect
			options={categories.map((c) => ({
				label: `${c.excluded ? "[ ]" : "[✓]"} ${c.value}`,
				value: c.value,
			}))}
			onChange={(value) => {
				goTo("/trips/settings/categories/edit", {
					props: {
						tripDirPath: trip.dirPath,
						tripName: trip.settings.name,
						value,
					},
				});
			}}
			onHighlight={(_, i) => setActiveIndex(i)}
			armedRowIndex={armed?.index ?? null}
			isActive={focus === "main"}
		/>
	);
}
