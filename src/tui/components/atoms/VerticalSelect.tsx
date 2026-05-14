import { Box, useInput } from "ink";
import type { JSX, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

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

	// Clamp cursor if rowCount shrinks below current cursor (e.g., after delete).
	const safeCursor = cursor >= rowCount ? Math.max(0, rowCount - 1) : cursor;

	// Surface cursor to parents via a ref so callers don't have to memoize
	// onHighlight. The ref always points at the latest closure; the effect only
	// re-runs when cursor or rowCount actually changes.
	const onHighlightRef = useRef(onHighlight);
	useEffect(() => {
		onHighlightRef.current = onHighlight;
	});

	useEffect(() => {
		if (rowCount > 0) {
			onHighlightRef.current?.(safeCursor);
		}
	}, [safeCursor, rowCount]);

	useInput(
		(input, key) => {
			if (rowCount === 0) {
				if ((key.escape || input === "q") && onCancel) onCancel();
				return;
			}

			if (key.upArrow) {
				setCursor((c) => (c > 0 ? c - 1 : rowCount - 1));
			} else if (key.downArrow) {
				setCursor((c) => (c < rowCount - 1 ? c + 1 : 0));
			} else if (key.return) {
				if (cursor < rowCount) onChange(cursor);
			} else if ((key.escape || input === "q") && onCancel) {
				onCancel();
			}
		},
		{ isActive },
	);

	return (
		<Box flexDirection="column">
			{Array.from({ length: rowCount }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: index is the stable id here
				<Box key={i}>{renderRow(i, isActive && i === safeCursor)}</Box>
			))}
		</Box>
	);
}
