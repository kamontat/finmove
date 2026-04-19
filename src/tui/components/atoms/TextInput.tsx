import { TextInput as InkTextInput } from "@inkjs/ui";
import { useInput } from "ink";
import type { JSX } from "react";

interface TextInputProps {
	placeholder?: string;
	defaultValue?: string;
	onSubmit: (value: string) => void;
	onCancel?: () => void;
}

export function TextInput({
	placeholder,
	defaultValue,
	onSubmit,
	onCancel,
}: TextInputProps): JSX.Element {
	useInput((_input, key) => {
		if (key.escape && onCancel) {
			onCancel();
		}
	});

	return (
		<InkTextInput
			{...(placeholder !== undefined ? { placeholder } : {})}
			{...(defaultValue !== undefined ? { defaultValue } : {})}
			onSubmit={onSubmit}
		/>
	);
}
