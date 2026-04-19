import { Text } from "ink";
import type { JSX } from "react";

interface CheckboxProps {
	label: string;
	checked: boolean;
	onToggle: () => void;
}

export function Checkbox({ label, checked }: CheckboxProps): JSX.Element {
	return (
		<Text>
			{checked ? "[x] " : "[ ] "}
			{label}
		</Text>
	);
}
