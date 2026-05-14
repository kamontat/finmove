import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { MultiSelectList } from "../components/organisms/MultiSelectList";
import type { HelpHint } from "../models";
import { useData } from "../states/data";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

const HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Space", label: "Toggle" },
	{ key: "Enter", label: "Confirm" },
	{ key: "q/esc", label: "Cancel" },
];

export function TagSelect(): JSX.Element {
	const { trip } = useData();
	const { goBack } = useNavigation();
	const { setHints, setColor, setTitleSuffix } = useLayout();
	const { setMenu } = useMenu();

	const { formId, fieldKey } = useRouteProps("/trips/expenses/form/tags");
	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setTitleSuffix("Select Tags");
		setColor({});
		setMenu([], () => {});
		setHints(HINTS);
	}, [setHints, setMenu, setColor, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const initialRaw = buffer.values[fieldKey];
	const initialSelected = Array.isArray(initialRaw) ? initialRaw : [];

	const options = trip.settings.tags.map((t) => ({ label: t, value: t }));

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
