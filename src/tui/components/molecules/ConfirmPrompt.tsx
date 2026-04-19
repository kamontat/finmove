import { ConfirmInput } from "@inkjs/ui";
import { Box } from "ink";
import type { JSX } from "react";
import { TextLabel } from "../atoms/TextLabel";

interface ConfirmPromptProps {
	message: string;
	onConfirm: (confirmed: boolean) => void;
}

export function ConfirmPrompt({
	message,
	onConfirm,
}: ConfirmPromptProps): JSX.Element {
	return (
		<Box flexDirection="column">
			<TextLabel text={message} bold />
			<ConfirmInput
				onConfirm={() => onConfirm(true)}
				onCancel={() => onConfirm(false)}
			/>
		</Box>
	);
}
