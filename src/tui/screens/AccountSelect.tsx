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

export function AccountSelect(): JSX.Element {
	const { trip } = useData();
	const { goBack } = useNavigation();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();

	const { formId, fieldKey } = useRouteProps("/trips/expenses/form/account");
	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setTitle(["Select Account"]);
		setColor({});
		setMenu([], () => {});
		setHints(HINTS);
		return () => clearTitle();
	}, [setHints, setMenu, setColor, setTitle, clearTitle]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const initialRaw = buffer.values[fieldKey];
	const initialValue = typeof initialRaw === "string" ? initialRaw : undefined;

	const options = trip.accounts.map((a) => ({
		label: `${a.name} (${a.type})`,
		value: a.id,
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
