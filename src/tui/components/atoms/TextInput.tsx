import { TextInput as InkTextInput } from "@inkjs/ui";
import type { JSX } from "react";

interface TextInputProps {
	placeholder?: string;
	defaultValue?: string;
	onSubmit: (value: string) => void;
}

export function TextInput({
	placeholder,
	defaultValue,
	onSubmit,
}: TextInputProps): JSX.Element {
	return (
		<InkTextInput
			{...(placeholder !== undefined ? { placeholder } : {})}
			{...(defaultValue !== undefined ? { defaultValue } : {})}
			onSubmit={onSubmit}
		/>
	);
}
