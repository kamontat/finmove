import { Box } from "ink";
import type { JSX } from "react";
import { TextInput } from "../atoms/text-input";
import { TextLabel } from "../atoms/text-label";

interface FormFieldProps {
	label: string;
	placeholder?: string;
	defaultValue?: string;
	onSubmit: (value: string) => void;
}

export function FormField({
	label,
	placeholder,
	defaultValue,
	onSubmit,
}: FormFieldProps): JSX.Element {
	return (
		<Box flexDirection="column">
			<TextLabel text={label} bold />
			<TextInput
				{...(placeholder !== undefined ? { placeholder } : {})}
				{...(defaultValue !== undefined ? { defaultValue } : {})}
				onSubmit={onSubmit}
			/>
		</Box>
	);
}
