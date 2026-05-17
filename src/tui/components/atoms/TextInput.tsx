import { TextInput as InkTextInput } from "@inkjs/ui";
import { useInput } from "ink";
import type { JSX } from "react";

interface TextInputProps {
	placeholder?: string;
	defaultValue?: string;
	onSubmit: (value: string) => void;
	onCancel?: () => void;
	onClear?: () => void;
}

export function TextInput({
	placeholder,
	defaultValue,
	onSubmit,
	onCancel,
	onClear,
}: TextInputProps): JSX.Element {
	useInput((_input, key) => {
		if (key.escape && onCancel) {
			onCancel();
		}
	});

	const handleSubmit = (value: string) => {
		if (value === "" && onClear) {
			onClear();
			return;
		}
		onSubmit(value);
	};

	return (
		<InkTextInput
			{...(placeholder !== undefined ? { placeholder } : {})}
			{...(defaultValue !== undefined ? { defaultValue } : {})}
			onSubmit={handleSubmit}
		/>
	);
}
