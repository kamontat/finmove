import { Text } from "ink";
import type { JSX } from "react";
import type { VerticalOption } from "../../models";
import { VerticalSelect } from "../atoms/VerticalSelect";

interface ListSelectProps {
	options: VerticalOption[];
	onChange: (value: string) => void;
	onHighlight?: (value: string) => void;
	onCancel?: () => void;
	isActive?: boolean;
	color?: string;
}

export function ListSelect({
	options,
	onChange,
	onHighlight,
	onCancel,
	isActive = true,
	color,
}: ListSelectProps): JSX.Element {
	return (
		<VerticalSelect
			rowCount={options.length}
			renderRow={(i, selected) => {
				const o = options[i];
				if (!o) return null;
				return (
					<Text
						inverse={selected}
						{...(color !== undefined ? { color } : {})}
					>
						{selected ? "> " : "  "}
						{o.label}
						{o.detail ? <Text dimColor={!selected}> {o.detail}</Text> : null}
					</Text>
				);
			}}
			onChange={(i) => {
				const o = options[i];
				if (o) onChange(o.value);
			}}
			{...(onHighlight
				? {
						onHighlight: (i: number) => {
							const o = options[i];
							if (o) onHighlight(o.value);
						},
					}
				: {})}
			{...(onCancel ? { onCancel } : {})}
			isActive={isActive}
		/>
	);
}
