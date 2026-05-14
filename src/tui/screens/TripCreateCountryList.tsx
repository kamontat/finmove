import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripCreateCountryList(): JSX.Element {
	const { focus } = useFocus();
	const { goTo } = useNavigation();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();

	const { dataDir = "./data" } = useRouteProps("/trips/new/countries");

	const buffer = useFormBuffer("trip-new");
	const raw = buffer.values["countries"];
	const countries = Array.isArray(raw) ? raw : [];

	useEffect(() => {
		setTitleSuffix("Countries");
		setBorderColor(null);
		const hasItems = countries.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasItems ? [{ label: "Delete", value: "delete", key: "x" }] : []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/new/countries/new", { props: { dataDir } });
				} else if (value === "delete" && hasItems) {
					goTo("/trips/new/countries/delete", { props: { dataDir } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		dataDir,
		countries.length,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

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
