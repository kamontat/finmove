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

export function TagList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus } = useFocus();
	const { setHints, setColor, setTitleSuffix } = useLayout();
	const { setMenu, armed, setActiveIndex } = useMenu();
	const { goTo, goBack } = useNavigation();

	useEffect(() => {
		setTitleSuffix("Settings > Tags");
		setColor({});
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;
		const tags = trip.settings.tags;
		const hasItems = tags.length > 0;

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
										const target = tags[i];
										if (target === undefined) return;
										const remaining = tags.filter((t) => t !== target);
										updateSettings(trip.dirPath, { tags: remaining });
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
			onHighlight={(_, i) => setActiveIndex(i)}
			armedRowIndex={armed?.value === "delete" ? armed.index : null}
			isActive={focus === "main"}
		/>
	);
}
