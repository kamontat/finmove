import { Box, type DOMElement, measureElement, Text, useInput } from "ink";
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
	const outerRef = useRef<DOMElement>(null);
	const contentRef = useRef<DOMElement>(null);
	const [offset, setOffset] = useState(0);
	const [viewportHeight, setViewportHeight] = useState(0);
	const [contentHeight, setContentHeight] = useState(0);

	useEffect(() => {
		if (!outerRef.current || !contentRef.current) return;
		const v = measureElement(outerRef.current).height;
		const c = measureElement(contentRef.current).height;
		setViewportHeight(v);
		setContentHeight(c);
	});

	const maxOffset = Math.max(0, contentHeight - viewportHeight);
	const clampedOffset = Math.min(offset, maxOffset);
	if (clampedOffset !== offset) {
		setOffset(clampedOffset);
	}

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
		if (clampedOffset === 0) glyph = "↓";
		else if (clampedOffset >= maxOffset) glyph = "↑";
		else glyph = "↕";
	}

	return (
		<Box ref={outerRef} flexGrow={1} flexDirection="column" overflow="hidden">
			<Box
				ref={contentRef}
				flexDirection="column"
				flexShrink={0}
				marginTop={-clampedOffset}
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
