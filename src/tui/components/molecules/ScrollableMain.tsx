import { Box, type DOMElement, Text, useBoxMetrics, useInput } from "ink";
import type { JSX, ReactNode, RefObject } from "react";
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

	const { height: viewportHeight, hasMeasured: outerMeasured } = useBoxMetrics(
		outerRef as RefObject<DOMElement>,
	);
	const { height: contentHeight, hasMeasured: contentMeasured } = useBoxMetrics(
		contentRef as RefObject<DOMElement>,
	);
	const hasMeasured = outerMeasured && contentMeasured;

	const maxOffset = Math.max(0, contentHeight - viewportHeight);

	useEffect(() => {
		if (!hasMeasured) return;
		setOffset((o) => Math.min(o, maxOffset));
	}, [hasMeasured, maxOffset]);

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

	const overflows = hasMeasured && contentHeight > viewportHeight;
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
				marginTop={hasMeasured ? -offset : 0}
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
