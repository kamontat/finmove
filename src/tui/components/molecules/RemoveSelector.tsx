import type { JSX } from "react";
import type { VerticalOption } from "../../models";
import { ListSelect } from "./ListSelect";

interface RemoveSelectorProps {
	options: VerticalOption[];
	onConfirm: (value: string) => void;
	onCancel?: () => void;
}

export function RemoveSelector({
	options,
	onConfirm,
	onCancel,
}: RemoveSelectorProps): JSX.Element {
	return (
		<ListSelect
			options={options}
			onChange={onConfirm}
			{...(onCancel ? { onCancel } : {})}
			color="red"
			isActive
		/>
	);
}
