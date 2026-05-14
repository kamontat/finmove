import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { SELECT_REMOVE_HINTS } from "../constants/hints";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function TripCreateCountryDelete(): JSX.Element {
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goBack } = useNavigation();

	const buffer = useFormBuffer("trip-new");
	const raw = buffer.values["countries"];
	const countries = Array.isArray(raw) ? raw : [];

	useEffect(() => {
		setBorderColor("red");
		setMenu([], () => {});
		setHints(SELECT_REMOVE_HINTS);
		setTitleSuffix("Countries > Delete");
		return () => {
			setBorderColor(null);
			setTitleSuffix(null);
		};
	}, [setBorderColor, setMenu, setHints, setTitleSuffix]);

	if (countries.length === 0) {
		return <Text dimColor>No countries.</Text>;
	}

	return (
		<RemoveSelector
			header="Select a country to delete:"
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
