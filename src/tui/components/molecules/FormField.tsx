import { Box } from "ink";
import type { JSX } from "react";
import { TextInput } from "../atoms/TextInput";
import { TextLabel } from "../atoms/TextLabel";

interface FormFieldProps {
	label: string;
	placeholder?: string;
	defaultValue?: string;
	onSubmit: (value: string) => void;
	onCancel?: () => void;
}

export function FormField({
	label,
	placeholder,
	defaultValue,
	onSubmit,
	onCancel,
}: FormFieldProps): JSX.Element {
	return (
		<Box flexDirection="column">
			<TextLabel text={label} bold />
			<TextInput
				{...(placeholder !== undefined ? { placeholder } : {})}
				{...(defaultValue !== undefined ? { defaultValue } : {})}
				onSubmit={onSubmit}
				{...(onCancel !== undefined ? { onCancel } : {})}
			/>
		</Box>
	);
}
