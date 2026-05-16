import { Text, useInput } from "ink";
import type { JSX } from "react";
import { useState } from "react";

interface CheckboxInputProps {
	defaultValue: boolean;
	trueLabel?: string;
	falseLabel?: string;
	onSubmit: (value: boolean) => void;
	onCancel?: () => void;
}

export function CheckboxInput({
	defaultValue,
	trueLabel = "Yes",
	falseLabel = "No",
	onSubmit,
	onCancel,
}: CheckboxInputProps): JSX.Element {
	const [checked, setChecked] = useState(defaultValue);

	useInput((input, key) => {
		if (input === " ") {
			setChecked((c) => !c);
		} else if (key.return) {
			onSubmit(checked);
		} else if (key.escape && onCancel) {
			onCancel();
		}
	});

	return (
		<Text>
			<Text color="cyan" bold>
				[{checked ? "x" : " "}]
			</Text>
			<Text> {checked ? trueLabel : falseLabel}</Text>
			<Text dimColor> (space toggle, Enter confirm)</Text>
		</Text>
	);
}
