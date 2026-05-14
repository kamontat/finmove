import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripCreateCountryDelete(): JSX.Element {
	const { setMenu, setHints, setColor, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();
	const { formId = "trip-new" } = useRouteProps("/trips/new/countries/delete");

	const buffer = useFormBuffer(formId);
	const raw = buffer.values["countries"];
	const countries = Array.isArray(raw) ? raw : [];

	useEffect(() => {
		setColor({ border: "red", title: "red" });
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix("Countries > Delete");
		return () => {
			setColor({});
			setTitleSuffix(null);
		};
	}, [setColor, setMenu, setHints, setTitleSuffix]);

	if (countries.length === 0) {
		return <Text dimColor>No countries.</Text>;
	}

	return (
		<RemoveSelector
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
