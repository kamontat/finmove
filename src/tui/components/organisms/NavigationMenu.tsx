import { Box } from "ink";
import type { JSX } from "react";
import type { SelectOption } from "../atoms/SelectInput";
import { SelectInput } from "../atoms/SelectInput";
import { TextLabel } from "../atoms/TextLabel";

interface NavigationMenuProps {
	title?: string;
	options: SelectOption[];
	onSelect: (value: string) => void;
}

export function NavigationMenu({
	title,
	options,
	onSelect,
}: NavigationMenuProps): JSX.Element {
	return (
		<Box gap={1}>
			{title !== undefined && <TextLabel text={`${title}:`} bold />}
			<SelectInput options={options} onChange={onSelect} />
		</Box>
	);
}
