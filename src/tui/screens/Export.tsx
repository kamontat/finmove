import { writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { Box } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { exportCSV } from "../../core/services/export";
import { TextLabel } from "../components/atoms/TextLabel";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { useNotification } from "../states/notification";
import { settingsTitle } from "../utils/titles";

export function ExportScreen(): JSX.Element {
	const { trip } = useData();
	const { goBack } = useNavigation();
	const { setHints, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();
	const { notify } = useNotification();

	const [exportedPath, setExportedPath] = useState<string | null>(null);

	useEffect(() => {
		if (!trip) return;
		try {
			const exportPath = trip.settings.exportPath ?? "./expenses.csv";
			const csv = exportCSV(trip);
			const fullPath = isAbsolute(exportPath)
				? exportPath
				: join(trip.dirPath, exportPath);
			writeFileSync(fullPath, csv);
			setExportedPath(exportPath);
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			notify(`Export failed: ${message}`, "error", { persistent: true });
			goBack();
		}
	}, [trip, notify, goBack]);

	useEffect(() => {
		setTitle(settingsTitle(trip, "Export CSV"));
		setMenu([{ label: "Back", value: "back", key: "b" }], () => goBack());
		setHints([
			{ key: "Enter", label: "Back" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
		return () => clearTitle();
	}, [setMenu, setHints, setTitle, clearTitle, trip, goBack]);

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
