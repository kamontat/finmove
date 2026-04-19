import { Text, useInput } from "ink";
import type { JSX } from "react";
import { useState } from "react";

export interface HelpHint {
	key: string;
	label: string;
}

interface HelpBarProps {
	hints: HelpHint[];
}

export function HelpBar({ hints }: HelpBarProps): JSX.Element {
	const [visible, setVisible] = useState(true);

	useInput((input) => {
		if (input === "?") {
			setVisible((v) => !v);
		}
	});

	if (!visible) {
		return <Text dimColor>[?] Show help</Text>;
	}

	return (
		<Text dimColor>
			{hints.map((h, i) => (
				<Text key={h.key}>
					{i > 0 ? " · " : ""}
					<Text>[{h.key}]</Text> {h.label}
				</Text>
			))}
		</Text>
	);
}
