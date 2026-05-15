import type { JSX } from "react";
import { useEffect } from "react";
import { SingleSelectList } from "../components/organisms/SingleSelectList";
import type { HelpHint, SelectOption } from "../models";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

const HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Confirm" },
	{ key: "q/esc", label: "Cancel" },
];

const OPTIONS: SelectOption[] = [
	{ label: "Credit", value: "Credit" },
	{ label: "Debit", value: "Debit" },
];

export function AccountTypeSelect(): JSX.Element {
	const { goBack } = useNavigation();
	const { setHints, setColor, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();

	const props = useRouteProps([
		"/trips/accounts/new/type",
		"/trips/accounts/edit/type",
	] as const);
	const formId = props.formId;
	const fieldKey = props.fieldKey;

	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setTitle(["Select Account Type"]);
		setColor({});
		setMenu([], () => {});
		setHints(HINTS);
		return () => clearTitle();
	}, [setHints, setMenu, setColor, setTitle, clearTitle]);

	const initialRaw = buffer.values[fieldKey];
	const initialValue = typeof initialRaw === "string" ? initialRaw : undefined;

	return (
		<SingleSelectList
			options={OPTIONS}
			initialValue={initialValue}
			onConfirm={(value) => {
				buffer.setField(fieldKey, value);
				goBack();
			}}
			onCancel={() => goBack()}
		/>
	);
}
