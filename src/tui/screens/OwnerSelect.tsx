import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { MultiSelectList } from "../components/organisms/MultiSelectList";
import type { HelpHint } from "../models";
import { useData } from "../states/data";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

const HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Space", label: "Toggle" },
	{ key: "Enter", label: "Confirm" },
	{ key: "q/esc", label: "Cancel" },
];

export function OwnerSelect(): JSX.Element {
	const { trip } = useData();
	const { goBack } = useNavigation();
	const { setHints, setMenu, setColor, setTitleSuffix } = useLayout();

	const props = useRouteProps([
		"/trips/accounts/new/owners",
		"/trips/accounts/edit/owners",
		"/trips/expenses/form/owners",
	] as const);
	const formId = props.formId;
	const fieldKey = props.fieldKey;

	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setTitleSuffix("Select Owners");
		setColor({});
		setMenu([], () => {});
		setHints(HINTS);
	}, [setHints, setMenu, setColor, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const initialRaw = buffer.values[fieldKey];
	const initialSelected = Array.isArray(initialRaw) ? initialRaw : [];

	const options = trip.owners.map((o) => ({ label: o.name, value: o.id }));

	return (
		<MultiSelectList
			options={options}
			initialSelected={initialSelected}
			onConfirm={(selected) => {
				buffer.setField(fieldKey, selected);
				goBack();
			}}
			onCancel={() => goBack()}
		/>
	);
}
