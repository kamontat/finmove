import { Box, Text, useInput } from "ink";
import type { JSX } from "react";
import { useState } from "react";
import type { SelectOption } from "../../models";

interface DropdownSelectProps {
	options: SelectOption[];
	defaultValue?: string;
	onSubmit: (value: string) => void;
	onCancel: () => void;
}

export function DropdownSelect({
	options,
	defaultValue,
	onSubmit,
	onCancel,
}: DropdownSelectProps): JSX.Element {
	const defaultIndex = defaultValue
		? Math.max(
				0,
				options.findIndex((o) => o.value === defaultValue),
			)
		: 0;
	const [cursor, setCursor] = useState(defaultIndex);

	useInput((_input, key) => {
		if (key.upArrow) {
			setCursor((c) => (c > 0 ? c - 1 : options.length - 1));
		} else if (key.downArrow) {
			setCursor((c) => (c < options.length - 1 ? c + 1 : 0));
		} else if (key.return) {
			const opt = options[cursor];
			if (opt) onSubmit(opt.value);
		} else if (key.escape) {
			onCancel();
		}
	});

	return (
		<Box flexDirection="column">
			{options.map((o, i) => {
				const selected = i === cursor;
				return (
					<Text key={o.value} inverse={selected}>
						{selected ? "> " : "  "}
						{o.label}
					</Text>
				);
			})}
		</Box>
	);
}
