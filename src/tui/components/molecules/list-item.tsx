import { Box, Text } from "ink";
import type { JSX } from "react";

interface ListItemProps {
	icon?: string;
	label: string;
	detail?: string;
}

export function ListItem({ icon, label, detail }: ListItemProps): JSX.Element {
	return (
		<Box gap={1}>
			{icon && <Text>{icon}</Text>}
			<Text>{label}</Text>
			{detail && <Text dimColor>{detail}</Text>}
		</Box>
	);
}
