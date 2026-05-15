import { writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { Box } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { exportCSV } from "../../core/services/export";
import { TextLabel } from "../components/atoms/TextLabel";
import { useDefaultFocus } from "../hooks/useDefaultFocus";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";

export function ExportScreen(): JSX.Element {
	useDefaultFocus("menu");
	const { trip } = useData();
	const { goBack } = useNavigation();
	const { setHints, setTitleSuffix } = useLayout();
	const { setMenu } = useMenu();

	const [exportedPath, setExportedPath] = useState<string | null>(null);

	useEffect(() => {
		if (!trip) return;
		const exportPath = trip.settings.exportPath ?? "./expenses.csv";
		const csv = exportCSV(trip);
		const fullPath = isAbsolute(exportPath)
			? exportPath
			: join(trip.dirPath, exportPath);
		writeFileSync(fullPath, csv);
		setExportedPath(exportPath);
	}, [trip]);

	useEffect(() => {
		setTitleSuffix("Settings > Export CSV");
		setMenu([{ label: "Back", value: "back", key: "b" }], () => goBack());
		setHints([
			{ key: "Enter", label: "Back" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
	}, [setMenu, setHints, setTitleSuffix, goBack]);

	if (!trip || !exportedPath) {
		return <Box />;
	}

	return (
		<TextLabel
			text={`"CSV exported successfully" at ${exportedPath}`}
			bold
			color="green"
		/>
	);
}
