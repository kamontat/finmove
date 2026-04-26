import { Box, Text, useInput } from "ink";
import { type JSX, useState } from "react";
import type { SelectOption } from "../../models";

interface MultiSelectListProps {
	options: SelectOption[];
	initialSelected: string[];
	onConfirm: (selected: string[]) => void;
	onCancel: () => void;
}

export function MultiSelectList({
	options,
	initialSelected,
	onConfirm,
	onCancel,
}: MultiSelectListProps): JSX.Element {
	const [cursor, setCursor] = useState(0);
	const [selected, setSelected] = useState<string[]>(() => [
		...initialSelected,
	]);

	useInput((input, key) => {
		if (key.upArrow) {
			setCursor((c) => (c > 0 ? c - 1 : Math.max(0, options.length - 1)));
		} else if (key.downArrow) {
			setCursor((c) => (c < options.length - 1 ? c + 1 : 0));
		} else if (input === " ") {
			const option = options[cursor];
			if (!option) return;
			setSelected((prev) =>
				prev.includes(option.value)
					? prev.filter((v) => v !== option.value)
					: [...prev, option.value],
			);
		} else if (key.return) {
			onConfirm(selected);
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
				const isSelected = selected.includes(option.value);
				const checkbox = isSelected ? "[x]" : "[ ]";
				return (
					<Text key={option.value}>
						{isCursor ? (
							<Text color="cyan" bold>
								{">"} {checkbox} {option.label}
							</Text>
						) : (
							<Text>
								{"  "}
								{checkbox} {option.label}
							</Text>
						)}
					</Text>
				);
			})}
		</Box>
	);
}
