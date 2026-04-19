import { writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { Box, Text } from "ink";
import type { JSX } from "react";
import { useState } from "react";
import type { Trip } from "../../core/models";
import { exportCSV } from "../../core/services/export";
import { TextLabel } from "../components/atoms/text-label";
import { ConfirmPrompt } from "../components/molecules/confirm-prompt";
import { FormField } from "../components/molecules/form-field";

interface ExportScreenProps {
	trip: Trip;
	onBack: () => void;
}

type Mode = "path" | "preview" | "done";

export function ExportScreen({ trip, onBack }: ExportScreenProps): JSX.Element {
	const [mode, setMode] = useState<Mode>("path");
	const [exportPath, setExportPath] = useState(trip.settings.exportPath);

	if (mode === "path") {
		return (
			<FormField
				label="Export path:"
				defaultValue={exportPath}
				onSubmit={(path) => {
					setExportPath(path);
					setMode("preview");
				}}
			/>
		);
	}

	const csv = exportCSV(trip);

	if (mode === "preview") {
		const previewLines = csv.split("\n").slice(0, 6);
		return (
			<Box flexDirection="column" gap={1}>
				<TextLabel text="CSV Preview:" bold color="cyan" />
				<Box flexDirection="column">
					{previewLines.map((line, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: preview lines have no stable identity
						<Text key={`line-${i}`}>{line}</Text>
					))}
					{csv.split("\n").length > 6 && (
						<Text dimColor>... and {csv.split("\n").length - 6} more rows</Text>
					)}
				</Box>
				<ConfirmPrompt
					message="Export this CSV?"
					onConfirm={(yes) => {
						if (yes) {
							const fullPath = isAbsolute(exportPath)
								? exportPath
								: join(trip.dirPath, exportPath);
							writeFileSync(fullPath, csv);
							setMode("done");
						} else {
							onBack();
						}
					}}
				/>
			</Box>
		);
	}

	// mode === "done"
	return (
		<Box flexDirection="column" gap={1}>
			<TextLabel text="CSV exported successfully!" bold color="green" />
			<TextLabel text={`Path: ${exportPath}`} dimColor />
			<ConfirmPrompt message="Go back?" onConfirm={() => onBack()} />
		</Box>
	);
}
