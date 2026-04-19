import { Box, Text, useInput } from "ink";
import type { JSX } from "react";

export interface SelectOption {
	label: string;
	value: string;
	key?: string;
}

interface SelectInputProps {
	options: SelectOption[];
	onChange: (value: string) => void;
}

export function SelectInput({
	options,
	onChange,
}: SelectInputProps): JSX.Element {
	useInput((input) => {
		if (!input) return;
		const lower = input.toLowerCase();
		const match = options.find((o) => o.key?.toLowerCase() === lower);
		if (match) {
			onChange(match.value);
		}
	});

	return (
		<Box gap={2} flexWrap="wrap">
			{options.map((o) => (
				<Text key={o.value}>
					{o.key ? (
						<>
							<Text dimColor>[</Text>
							<Text color="cyan" bold>
								{o.key}
							</Text>
							<Text dimColor>]</Text>
							<Text> {o.label}</Text>
						</>
					) : (
						<Text dimColor>{o.label}</Text>
					)}
				</Text>
			))}
		</Box>
	);
}
