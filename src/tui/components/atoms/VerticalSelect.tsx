import { Box, Text, useInput } from "ink";
import type { JSX } from "react";
import { useState } from "react";
import type { VerticalOption } from "../../models";

export type { VerticalOption } from "../../models";

interface VerticalSelectProps {
	options: VerticalOption[];
	onChange: (value: string) => void;
	onHighlight?: (value: string) => void;
	onCancel?: () => void;
	isActive?: boolean;
	color?: string;
}

export function VerticalSelect({
	options,
	onChange,
	onHighlight,
	onCancel,
	isActive = true,
	color,
}: VerticalSelectProps): JSX.Element {
	const [cursor, setCursor] = useState(0);

	useInput(
		(input, key) => {
			if (key.upArrow) {
				setCursor((c) => {
					const next = c > 0 ? c - 1 : options.length - 1;
					const opt = options[next];
					if (opt && onHighlight) onHighlight(opt.value);
					return next;
				});
			} else if (key.downArrow) {
				setCursor((c) => {
					const next = c < options.length - 1 ? c + 1 : 0;
					const opt = options[next];
					if (opt && onHighlight) onHighlight(opt.value);
					return next;
				});
			} else if (key.return) {
				const opt = options[cursor];
				if (opt) onChange(opt.value);
			} else if (key.escape && onCancel) {
				onCancel();
			} else if (input === "q" && onCancel) {
				onCancel();
			}
		},
		{ isActive },
	);

	if (options.length === 0) {
		return <Text dimColor>No items.</Text>;
	}

	return (
		<Box flexDirection="column">
			{options.map((o, i) => {
				const selected = isActive && i === cursor;
				return (
					<Text
						key={o.value}
						inverse={selected}
						{...(color !== undefined ? { color } : {})}
					>
						{selected ? "> " : "  "}
						{o.label}
						{o.detail ? <Text dimColor={!selected}> {o.detail}</Text> : null}
					</Text>
				);
			})}
		</Box>
	);
}
