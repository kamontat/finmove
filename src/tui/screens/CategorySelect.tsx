import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { SingleSelectList } from "../components/organisms/SingleSelectList";
import type { HelpHint } from "../models";
import { useData } from "../states/data";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

const HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Confirm" },
	{ key: "q/esc", label: "Cancel" },
];

export function CategorySelect(): JSX.Element {
	const { trip } = useData();
	const { goBack } = useNavigation();
	const { setHints, setColor, setTitleSuffix } = useLayout();
	const { setMenu } = useMenu();

	const { formId, fieldKey } = useRouteProps("/trips/expenses/form/category");
	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setTitleSuffix("Select Category");
		setColor({});
		setMenu([], () => {});
		setHints(HINTS);
	}, [setHints, setMenu, setColor, setTitleSuffix]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const initialRaw = buffer.values[fieldKey];
	const initialValue = typeof initialRaw === "string" ? initialRaw : undefined;

	const options = trip.settings.categories.map((c) => ({
		label: c,
		value: c,
	}));

	return (
		<SingleSelectList
			options={options}
			initialValue={initialValue}
			onConfirm={(value) => {
				buffer.setField(fieldKey, value);
				goBack();
			}}
			onCancel={() => goBack()}
		/>
	);
}
