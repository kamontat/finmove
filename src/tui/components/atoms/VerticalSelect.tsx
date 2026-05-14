import { Box, useInput } from "ink";
import type { JSX, ReactNode } from "react";
import { useEffect, useState } from "react";

interface VerticalSelectProps {
	rowCount: number;
	renderRow: (index: number, selected: boolean) => ReactNode;
	onChange: (index: number) => void;
	onHighlight?: (index: number) => void;
	onCancel?: () => void;
	isActive?: boolean;
}

export function VerticalSelect({
	rowCount,
	renderRow,
	onChange,
	onHighlight,
	onCancel,
	isActive = true,
}: VerticalSelectProps): JSX.Element {
	const [cursor, setCursor] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: fire only on mount
	useEffect(() => {
		if (rowCount > 0 && onHighlight) {
			onHighlight(0);
		}
	}, []);

	useInput(
		(input, key) => {
			if (rowCount === 0) {
				if ((key.escape || input === "q") && onCancel) onCancel();
				return;
			}

			if (key.upArrow) {
				setCursor((c) => {
					const next = c > 0 ? c - 1 : rowCount - 1;
					if (onHighlight) onHighlight(next);
					return next;
				});
			} else if (key.downArrow) {
				setCursor((c) => {
					const next = c < rowCount - 1 ? c + 1 : 0;
					if (onHighlight) onHighlight(next);
					return next;
				});
			} else if (key.return) {
				if (cursor < rowCount) onChange(cursor);
			} else if ((key.escape || input === "q") && onCancel) {
				onCancel();
			}
		},
		{ isActive },
	);

	// Clamp cursor if rowCount shrinks below current cursor (e.g., after delete).
	const safeCursor = cursor >= rowCount ? Math.max(0, rowCount - 1) : cursor;

	return (
		<Box flexDirection="column">
			{Array.from({ length: rowCount }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: index is the stable id here
				<Box key={i}>{renderRow(i, isActive && i === safeCursor)}</Box>
			))}
		</Box>
	);
}
