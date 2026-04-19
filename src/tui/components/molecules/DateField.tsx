import { Box } from "ink";
import type { JSX } from "react";
import { DateInput } from "../atoms/date-input";
import { TextLabel } from "../atoms/text-label";

interface DateFieldProps {
	label: string;
	defaultValue: string;
	onSubmit: (value: string) => void;
}

export function DateField({
	label,
	defaultValue,
	onSubmit,
}: DateFieldProps): JSX.Element {
	return (
		<Box flexDirection="column">
			<TextLabel text={label} bold />
			<DateInput defaultValue={defaultValue} onSubmit={onSubmit} />
		</Box>
	);
}
