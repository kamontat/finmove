import { Box, Text } from "ink";
import type { JSX } from "react";

interface DataTableProps {
	headers: string[];
	rows: string[][];
}

export function DataTable({ headers, rows }: DataTableProps): JSX.Element {
	const colWidths = headers.map((h, i) => {
		const maxData = rows.reduce(
			(max, row) => Math.max(max, (row[i] ?? "").length),
			0,
		);
		return Math.max(h.length, maxData) + 2;
	});

	return (
		<Box flexDirection="column">
			<Box>
				{headers.map((h, i) => (
					<Box key={h} width={colWidths[i]}>
						<Text bold>{h}</Text>
					</Box>
				))}
			</Box>
			{rows.map((row, ri) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable identity
				<Box key={`row-${ri}`}>
					{row.map((cell, ci) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: cells have no stable identity
						<Box key={`cell-${ri}-${ci}`} width={colWidths[ci]}>
							<Text>{cell}</Text>
						</Box>
					))}
				</Box>
			))}
		</Box>
	);
}
