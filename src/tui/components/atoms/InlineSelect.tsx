import { Text, useInput } from "ink";
import type { JSX } from "react";
import { useState } from "react";
import type { SelectOption } from "../../models";

interface InlineSelectProps {
	options: SelectOption[];
	defaultValue?: string;
	onSubmit: (value: string) => void;
	onCancel: () => void;
}

export function InlineSelect({
	options,
	defaultValue,
	onSubmit,
	onCancel,
}: InlineSelectProps): JSX.Element {
	const defaultIndex = defaultValue
		? Math.max(
				0,
				options.findIndex((o) => o.value === defaultValue),
			)
		: 0;
	const [cursor, setCursor] = useState(defaultIndex);

	useInput((_input, key) => {
		if (key.leftArrow) {
			setCursor((c) => (c > 0 ? c - 1 : options.length - 1));
		} else if (key.rightArrow) {
			setCursor((c) => (c < options.length - 1 ? c + 1 : 0));
		} else if (key.return) {
			const opt = options[cursor];
			if (opt) onSubmit(opt.value);
		} else if (key.escape) {
			onCancel();
		}
	});

	const current = options[cursor];

	return (
		<Text>
			<Text color="cyan">{"< "}</Text>
			<Text bold>{current?.label ?? ""}</Text>
			<Text color="cyan">{" >"}</Text>
			<Text dimColor> (←/→ select, Enter confirm, Esc cancel)</Text>
		</Text>
	);
}
