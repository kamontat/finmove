import { Box, Text, useInput } from "ink";
import type { JSX } from "react";
import { useState } from "react";
import type { SelectOption } from "../../models";
import { useFocus } from "../../states/focus";

export type { SelectOption } from "../../models";

interface SelectInputProps {
	options: SelectOption[];
	onChange: (value: string) => void;
	isActive?: boolean;
	onCancel?: () => void;
	initialIndex?: number;
}

export function SelectInput({
	options,
	onChange,
	isActive = true,
	onCancel,
	initialIndex,
}: SelectInputProps): JSX.Element {
	const [cursor, setCursor] = useState(initialIndex ?? 0);
	const { focus } = useFocus();

	// Arrow navigation and Enter only when focused
	useInput(
		(_input, key) => {
			if (key.leftArrow) {
				setCursor((c) => (c > 0 ? c - 1 : options.length - 1));
			} else if (key.rightArrow) {
				setCursor((c) => (c < options.length - 1 ? c + 1 : 0));
			} else if (key.return) {
				const opt = options[cursor];
				if (opt) onChange(opt.value);
			} else if (key.escape) {
				onCancel?.();
			}
		},
		{ isActive },
	);

	// Shortcut keys work except during input mode (editing form fields)
	useInput((input, key) => {
		if (focus === "input") return;
		if (!input || key.escape || input === "q" || input === "e" || input === "?")
			return;
		const lower = input.toLowerCase();
		const match = options.find((o) => o.key?.toLowerCase() === lower);
		if (match) onChange(match.value);
	});

	return (
		<Box gap={2} flexWrap="wrap">
			{options.map((o, i) => {
				const selected = isActive && i === cursor;
				return (
					<Text key={o.value} inverse={selected}>
						{o.key ? (
							<>
								<Text dimColor={!selected}>[</Text>
								<Text {...(selected ? {} : { color: "cyan" })} bold>
									{o.key}
								</Text>
								<Text dimColor={!selected}>]</Text>
								<Text> {o.label}</Text>
							</>
						) : (
							<Text>{o.label}</Text>
						)}
					</Text>
				);
			})}
		</Box>
	);
}
