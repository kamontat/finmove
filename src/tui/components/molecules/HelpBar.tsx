import { Text } from "ink";
import type { JSX } from "react";
import type { HelpHint } from "../../models";
import { useHelp } from "../../states/help";

export type { HelpHint } from "../../models";

interface HelpBarProps {
	hints: HelpHint[];
}

export function HelpBar({ hints }: HelpBarProps): JSX.Element {
	const { visible } = useHelp();

	if (!visible) {
		return <Text dimColor>[?] Help</Text>;
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
