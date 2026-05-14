import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function OwnerList(): JSX.Element {
	const { trip } = useData();
	const { focus, setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();

	useEffect(() => {
		if (!trip) return;
		setFocus(trip.owners.length > 0 ? "main" : "menu");
	}, [trip, setFocus]);

	useEffect(() => {
		setTitleSuffix(null);
		setBorderColor(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasOwners = trip.owners.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasOwners ? [{ label: "Delete", value: "delete", key: "x" }] : []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/owners/new", { props: { tripDirPath } });
				} else if (value === "delete" && hasOwners) {
					goTo("/trips/owners/delete", { props: { tripDirPath } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [trip, setMenu, setHints, setBorderColor, setTitleSuffix, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (trip.owners.length === 0) {
		return <Text dimColor>No owners yet.</Text>;
	}

	return (
		<ListSelect
			options={trip.owners.map((o) => ({
				label: o.name,
				value: o.id,
				detail: `(${o.id})`,
			}))}
			onChange={(ownerId) => {
				goTo("/trips/owners/edit", {
					props: { tripDirPath: trip.dirPath, ownerId },
				});
			}}
			isActive={focus === "main"}
		/>
	);
}
