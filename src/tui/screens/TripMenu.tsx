import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function TripMenu(): JSX.Element {
	const { trip } = useData();
	const { goTo } = useNavigation();
	const { setMenu, setHints } = useLayout();
	const { setMenuAvailable } = useFocus();

	useEffect(() => {
		if (!trip) return;

		const tripDirPath = trip.dirPath;

		setMenu(
			[
				{ label: "Owners", value: "owners", key: "o" },
				{ label: "Accounts", value: "accounts", key: "a" },
				{ label: "Expenses", value: "expenses", key: "e" },
				{ label: "Export CSV", value: "export", key: "x" },
			],
			(value) => {
				if (value === "owners") {
					goTo("/trips/owners", { props: { tripDirPath } });
				} else if (value === "accounts") {
					goTo("/trips/accounts", { props: { tripDirPath } });
				} else if (value === "expenses") {
					goTo("/trips/expenses", { props: { tripDirPath } });
				} else if (value === "export") {
					goTo("/trips/export", { props: { tripDirPath } });
				}
			},
		);
		setHints([{ key: "?", label: "help" }]);
		setMenuAvailable(true);
	}, [trip, setMenu, setHints, setMenuAvailable, goTo]);

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
