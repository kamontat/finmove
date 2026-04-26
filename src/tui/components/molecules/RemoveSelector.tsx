import { Box, Text } from "ink";
import type { JSX } from "react";
import type { VerticalOption } from "../../models";
import { ListSelect } from "./ListSelect";

interface RemoveSelectorProps {
	header: string;
	options: VerticalOption[];
	onConfirm: (value: string) => void;
	onCancel?: () => void;
}

export function RemoveSelector({
	header,
	options,
	onConfirm,
	onCancel,
}: RemoveSelectorProps): JSX.Element {
	return (
		<Box flexDirection="column">
			<Text bold color="red">
				{header}
			</Text>
			<ListSelect
				options={options}
				onChange={onConfirm}
				{...(onCancel ? { onCancel } : {})}
				color="red"
				isActive
			/>
		</Box>
	);
}
