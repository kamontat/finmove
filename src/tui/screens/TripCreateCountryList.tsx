import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { LIST_HINTS, SELECT_REMOVE_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripCreateCountryList(): JSX.Element {
	const { focus } = useFocus();
	const { goTo, goBack } = useNavigation();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const { dataDir = "./data", selectMode } = useRouteProps(
		"/trips/new/countries",
	);

	const buffer = useFormBuffer("trip-new");
	const raw = buffer.values["countries"];
	const countries = Array.isArray(raw) ? raw : [];

	useEffect(() => {
		setTitleSuffix("Countries");
		const hasItems = countries.length > 0;

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
					goTo("/trips/new/countries/new", { props: { dataDir } });
				} else if (value === "delete" && hasItems) {
					goTo("/trips/new/countries", {
						props: { dataDir, selectMode: "remove" },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		dataDir,
		selectMode,
		countries.length,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

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
					buffer.setField("countries", remaining);
					if (remaining.length === 0) {
						goBack();
					}
				}}
			/>
		);
	}

	if (countries.length === 0) {
		return <Text dimColor>No countries yet. Press [a] to add one.</Text>;
	}

	return (
		<ListSelect
			options={countries.map((c) => ({ label: c, value: c }))}
			onChange={() => {
				/* read-only navigation; edit is via Delete + Add */
			}}
			isActive={focus === "main"}
		/>
	);
}
