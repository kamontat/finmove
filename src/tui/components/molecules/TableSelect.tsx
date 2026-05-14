import { Box, Text } from "ink";
import type { JSX } from "react";
import { VerticalSelect } from "../atoms/VerticalSelect";

export interface TableCell {
	text: string;
	color?: string;
}

interface TableSelectProps {
	headers: string[];
	rows: TableCell[][];
	onChange: (rowIndex: number) => void;
	onHighlight?: (rowIndex: number) => void;
	onCancel?: () => void;
	isActive?: boolean;
	armedRowIndex?: number | null;
}

export function TableSelect({
	headers,
	rows,
	onChange,
	onHighlight,
	onCancel,
	isActive = true,
	armedRowIndex,
}: TableSelectProps): JSX.Element {
	const colWidths = headers.map((h, i) => {
		const maxData = rows.reduce(
			(max, row) => Math.max(max, (row[i]?.text ?? "").length),
			0,
		);
		return Math.max(h.length, maxData) + 2;
	});

	const padCell = (text: string, i: number): string =>
		text.padEnd(colWidths[i] ?? 0);

	return (
		<Box flexDirection="column">
			<Box>
				<Text bold>
					{"  "}
					{headers.map((h, i) => padCell(h, i)).join("")}
				</Text>
			</Box>

			<VerticalSelect
				rowCount={rows.length}
				renderRow={(rowIdx, selected) => {
					const row = rows[rowIdx] ?? [];
					const armed = armedRowIndex === rowIdx;
					return (
						<Box>
							<Text inverse={selected} {...(armed ? { color: "red" } : {})}>
								{selected ? "> " : "  "}
							</Text>
							{headers.map((_, colIdx) => {
								const cell = row[colIdx] ?? { text: "" };
								const padded = padCell(cell.text, colIdx);
								const cellColor = armed ? "red" : cell.color;
								return (
									<Text
										// biome-ignore lint/suspicious/noArrayIndexKey: index is the stable id here
										key={colIdx}
										inverse={selected}
										{...(cellColor !== undefined ? { color: cellColor } : {})}
									>
										{padded}
									</Text>
								);
							})}
						</Box>
					);
				}}
				onChange={onChange}
				{...(onHighlight ? { onHighlight } : {})}
				{...(onCancel ? { onCancel } : {})}
				isActive={isActive}
			/>
		</Box>
	);
}
