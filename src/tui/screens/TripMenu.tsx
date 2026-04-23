import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { useData } from "../states/data";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function TripMenu(): JSX.Element {
	const { trip } = useData();
	const { goTo } = useNavigation();
	const { setMenu, setHints } = useLayout();
	useEffect(() => {
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;

		setMenu(
			[
				{ label: "Owners", value: "owners", key: "o" },
				{ label: "Accounts", value: "accounts", key: "a" },
				{ label: "Expenses", value: "expenses", key: "e" },
				{ label: "Settings", value: "settings", key: "s" },
			],
			(value) => {
				if (value === "owners") {
					goTo("/trips/owners", { props: { tripDirPath } });
				} else if (value === "accounts") {
					goTo("/trips/accounts", { props: { tripDirPath } });
				} else if (value === "expenses") {
					goTo("/trips/expenses", { props: { tripDirPath } });
				} else if (value === "settings") {
					goTo("/trips/settings", { props: { tripDirPath, tripName } });
				}
			},
		);
		setHints([
			{ key: "tab", label: "Switch focus" },
			{ key: "←→", label: "Navigate menu" },
			{ key: "Enter", label: "Confirm" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
	}, [trip, setMenu, setHints, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const { settings } = trip;
	return (
		<Text dimColor>
			{settings.startDate} — {settings.endDate} |{" "}
			{settings.countries.join(", ")}
		</Text>
	);
}
