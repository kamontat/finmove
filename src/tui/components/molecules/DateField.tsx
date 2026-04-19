import { Box } from "ink";
import type { JSX } from "react";
import { DateInput } from "../atoms/DateInput";
import { TextLabel } from "../atoms/TextLabel";

interface DateFieldProps {
	label: string;
	defaultValue: string;
	onSubmit: (value: string) => void;
	onCancel?: () => void;
}

export function DateField({
	label,
	defaultValue,
	onSubmit,
	onCancel,
}: DateFieldProps): JSX.Element {
	return (
		<Box flexDirection="column">
			<TextLabel text={label} bold />
			<DateInput
				defaultValue={defaultValue}
				onSubmit={onSubmit}
				{...(onCancel !== undefined ? { onCancel } : {})}
			/>
		</Box>
	);
}
