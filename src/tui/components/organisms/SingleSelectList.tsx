import { Box, Text, useInput } from "ink";
import { type JSX, useState } from "react";
import type { SelectOption } from "../../models";

interface SingleSelectListProps {
	options: SelectOption[];
	initialValue: string | undefined;
	onConfirm: (value: string) => void;
	onCancel: () => void;
}

export function SingleSelectList({
	options,
	initialValue,
	onConfirm,
	onCancel,
}: SingleSelectListProps): JSX.Element {
	const [cursor, setCursor] = useState(() => {
		if (initialValue === undefined) return 0;
		const found = options.findIndex((o) => o.value === initialValue);
		return found >= 0 ? found : 0;
	});

	useInput((_input, key) => {
		if (key.upArrow) {
			setCursor((c) => (c > 0 ? c - 1 : Math.max(0, options.length - 1)));
		} else if (key.downArrow) {
			setCursor((c) => (c < options.length - 1 ? c + 1 : 0));
		} else if (key.return) {
			const opt = options[cursor];
			if (opt) onConfirm(opt.value);
		} else if (key.escape) {
			onCancel();
		}
	});

	if (options.length === 0) {
		return <Text dimColor>No options available.</Text>;
	}

	return (
		<Box flexDirection="column">
			{options.map((option, index) => {
				const isCursor = cursor === index;
				return (
					<Text key={option.value} inverse={isCursor}>
						{isCursor ? "> " : "  "}
						{option.label}
					</Text>
				);
			})}
		</Box>
	);
}
