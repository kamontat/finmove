import { Text } from "ink";
import type { JSX } from "react";

interface TextLabelProps {
	text: string;
	bold?: boolean;
	color?: string;
	dimColor?: boolean;
}

export function TextLabel({
	text,
	bold,
	color,
	dimColor,
}: TextLabelProps): JSX.Element {
	return (
		<Text
			{...(bold !== undefined ? { bold } : {})}
			{...(color !== undefined ? { color: color as string } : {})}
			{...(dimColor !== undefined ? { dimColor } : {})}
		>
			{text}
		</Text>
	);
}
