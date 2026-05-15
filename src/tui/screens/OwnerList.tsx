import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { findOwnerReferences, removeOwner } from "../../core/services/owner";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { tripTitle } from "../utils/titles";

export function OwnerList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus, setFocus } = useFocus();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu, armed, setActiveIndex } = useMenu();
	const { goTo, goBack } = useNavigation();

	useEffect(() => {
		if (!trip) return;
		setFocus(trip.owners.length > 0 ? "main" : "menu");
	}, [trip, setFocus]);

	useEffect(() => {
		setTitle(tripTitle(trip, "Owners"));
		return () => clearTitle();
	}, [setTitle, clearTitle, trip]);

	useEffect(() => {
		setColor({});
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasOwners = trip.owners.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasOwners
					? [
							{
								label: "Delete",
								value: "delete",
								key: "x",
								mainAction: {
									confirmCount: 2,
									check: (i: number) => {
										const owner = trip.owners[i];
										if (!owner) return false;
										const refs = findOwnerReferences(trip, owner.id);
										if (refs.accounts.length > 0 || refs.expenses.length > 0) {
											goTo("/trips/owners/references", {
												props: { tripDirPath, ownerId: owner.id },
											});
											return false;
										}
										return true;
									},
									onConfirm: (i: number) => {
										const owner = trip.owners[i];
										if (!owner) return;
										removeOwner(trip, owner.id);
										reloadTrip();
										if (trip.owners.length === 0) {
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
					goTo("/trips/owners/new", { props: { tripDirPath } });
				} else if (value === "delete" && hasOwners) {
					goTo("/trips/owners/delete", { props: { tripDirPath } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [trip, reloadTrip, setMenu, setHints, setColor, goTo, goBack]);

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
			onHighlight={(_, i) => setActiveIndex(i)}
			armedRowIndex={armed?.index ?? null}
			isActive={focus === "main"}
		/>
	);
}
