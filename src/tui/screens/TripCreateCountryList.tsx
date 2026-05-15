import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useFocus } from "../states/focus";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripCreateCountryList(): JSX.Element {
	const { focus } = useFocus();
	const { goTo, goBack } = useNavigation();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu, armed, setActiveIndex } = useMenu();

	const { dataDir = "./data", formId = "trip-new" } = useRouteProps(
		"/trips/new/countries",
	);

	const buffer = useFormBuffer(formId);
	const { setField } = buffer;
	const raw = buffer.values["countries"];
	const countries = Array.isArray(raw) ? raw : [];

	useEffect(() => {
		setTitle(["Trips", "Countries"]);
		setColor({});
		const hasItems = countries.length > 0;

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
										const target = countries[i];
										if (target === undefined) return;
										const remaining = countries.filter((c) => c !== target);
										setField("countries", remaining);
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
					goTo("/trips/new/countries/new", { props: { dataDir, formId } });
				} else if (value === "delete" && hasItems) {
					goTo("/trips/new/countries/delete", { props: { dataDir, formId } });
				}
			},
		);
		setHints(LIST_HINTS);
		return () => clearTitle();
	}, [
		dataDir,
		formId,
		countries,
		setField,
		setMenu,
		setHints,
		setColor,
		setTitle,
		clearTitle,
		goTo,
		goBack,
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
			onHighlight={(_, i) => setActiveIndex(i)}
			armedRowIndex={armed?.index ?? null}
			isActive={focus === "main"}
		/>
	);
}
