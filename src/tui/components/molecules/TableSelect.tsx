import { Box, Text } from "ink";
import type { JSX } from "react";
import { VerticalSelect } from "../atoms/VerticalSelect";

interface TableSelectProps {
	headers: string[];
	rows: string[][];
	onChange: (rowIndex: number) => void;
	onCancel?: () => void;
	isActive?: boolean;
}

export function TableSelect({
	headers,
	rows,
	onChange,
	onCancel,
	isActive = true,
}: TableSelectProps): JSX.Element {
	const colWidths = headers.map((h, i) => {
		const maxData = rows.reduce(
			(max, row) => Math.max(max, (row[i] ?? "").length),
			0,
		);
		return Math.max(h.length, maxData) + 2;
	});

	const formatRow = (cells: string[]): string =>
		cells.map((cell, i) => (cell ?? "").padEnd(colWidths[i] ?? 0)).join("");

	return (
		<Box flexDirection="column">
			{/* Header row — non-selectable, bold */}
			<Box>
				<Text bold>
					{"  "}
					{formatRow(headers)}
				</Text>
			</Box>

			<VerticalSelect
				rowCount={rows.length}
				renderRow={(i, selected) => {
					const row = rows[i] ?? [];
					return (
						<Text inverse={selected}>
							{selected ? "> " : "  "}
							{formatRow(row)}
						</Text>
					);
				}}
				onChange={onChange}
				{...(onCancel ? { onCancel } : {})}
				isActive={isActive}
			/>
		</Box>
	);
}
