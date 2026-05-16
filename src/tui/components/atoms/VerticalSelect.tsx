import {
	Box,
	type DOMElement,
	measureElement,
	Text,
	useInput,
	useStdout,
} from "ink";
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
				onChange(safeCursor);
			} else if ((key.escape || input === "q") && onCancel) {
				onCancel();
			}
		},
		{ isActive },
	);

	const outerRef = useRef<DOMElement>(null);
	const [viewportHeight, setViewportHeight] = useState(0);

	const { stdout } = useStdout();
	const termRows = stdout?.rows ?? 0;
	const termCols = stdout?.columns ?? 0;

	// biome-ignore lint/correctness/useExhaustiveDependencies: termRows/termCols re-trigger measurement on resize
	useEffect(() => {
		if (!outerRef.current) return;
		setViewportHeight(measureElement(outerRef.current).height);
	}, [termRows, termCols]);

	const visibleRows = Math.max(1, viewportHeight);

	const [scrollOffset, setScrollOffset] = useState(0);

	useEffect(() => {
		setScrollOffset((o) => {
			if (safeCursor < o) return safeCursor;
			if (safeCursor >= o + visibleRows) return safeCursor - visibleRows + 1;
			return Math.min(o, Math.max(0, rowCount - visibleRows));
		});
	}, [safeCursor, visibleRows, rowCount]);

	const start = scrollOffset;
	const end = Math.min(rowCount, start + visibleRows);
	const overflowing = rowCount > visibleRows;

	return (
		<Box ref={outerRef} flexGrow={1} flexDirection="column" overflow="hidden">
			<Box flexDirection="column" flexShrink={0}>
				{Array.from({ length: end - start }, (_, i) => {
					const idx = start + i;
					return (
						<Box key={idx}>
							{renderRow(idx, isActive && idx === safeCursor)}
						</Box>
					);
				})}
			</Box>
			{overflowing && (
				<Box position="absolute" bottom={0} right={0}>
					<Text dimColor>
						{safeCursor + 1}/{rowCount}
					</Text>
				</Box>
			)}
		</Box>
	);
}
