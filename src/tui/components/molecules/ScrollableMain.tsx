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

interface ScrollableMainProps {
	isActive: boolean;
	children: ReactNode;
}

export function ScrollableMain({
	isActive,
	children,
}: ScrollableMainProps): JSX.Element {
	const { stdout } = useStdout();
	const rows = stdout?.rows ?? 0;
	const cols = stdout?.columns ?? 0;

	const outerRef = useRef<DOMElement>(null);
	const contentRef = useRef<DOMElement>(null);
	const [offset, setOffset] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(0);
	const [contentHeight, setContentHeight] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: rows/cols deps re-trigger measurement on terminal resize
	useEffect(() => {
		if (!outerRef.current || !contentRef.current) return;
		const v = measureElement(outerRef.current).height;
		const c = measureElement(contentRef.current).height;
		setViewportHeight(v);
		setContentHeight(c);
		setOffset((o) => Math.min(o, Math.max(0, c - v)));
	}, [rows, cols]);

	const maxOffset = Math.max(0, contentHeight - viewportHeight);

	useInput(
		(_, key) => {
			if (key.upArrow) {
				setOffset((o) => Math.max(0, o - 1));
			} else if (key.downArrow) {
				setOffset((o) => Math.min(maxOffset, o + 1));
			}
		},
		{ isActive },
	);

	const overflows = contentHeight > viewportHeight;
	let glyph: string | null = null;
	if (overflows) {
		if (offset === 0) glyph = "↓";
		else if (offset >= maxOffset) glyph = "↑";
		else glyph = "↕";
	}

	return (
		<Box ref={outerRef} flexGrow={1} flexDirection="column" overflow="hidden">
			<Box
				ref={contentRef}
				flexDirection="column"
				flexShrink={0}
				marginTop={-offset}
			>
				{children}
			</Box>
			{glyph !== null && (
				<Box position="absolute" bottom={0} right={0}>
					<Text dimColor>{glyph}</Text>
				</Box>
			)}
		</Box>
	);
}
