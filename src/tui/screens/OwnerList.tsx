import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { removeOwner } from "../../core/services/owner";
import { ListSelect } from "../components/molecules/ListSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { LIST_HINTS, SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function OwnerList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus, setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack } = useNavigation();

	const { selectMode } = useRouteProps("/trips/owners");

	useEffect(() => {
		if (!trip || selectMode) return;
		setFocus(trip.owners.length > 0 ? "main" : "menu");
	}, [trip, selectMode, setFocus]);

	useEffect(() => {
		setTitleSuffix(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasOwners = trip.owners.length > 0;

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
				...(hasOwners ? [{ label: "Remove", value: "remove", key: "x" }] : []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/owners/new", { props: { tripDirPath } });
				} else if (value === "remove" && hasOwners) {
					goTo("/trips/owners", {
						props: { tripDirPath, selectMode: "remove" },
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

	if (selectMode === "remove") {
		if (trip.owners.length === 0) {
			return <Text dimColor>No owners.</Text>;
		}
		return (
			<RemoveSelector
				header="Select an owner to remove:"
				options={trip.owners.map((o) => ({
					label: o.name,
					value: o.id,
					detail: `(${o.id})`,
				}))}
				onConfirm={(value) => {
					removeOwner(trip, value);
					reloadTrip();
					if (trip.owners.length === 0) {
						goBack();
					}
				}}
			/>
		);
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
