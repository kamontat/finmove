import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { today } from "../../core/services/date";
import { getTripStatus } from "../../core/services/trip";
import { TripDashboard } from "../components/organisms/TripDashboard";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { tripTitle } from "../utils/titles";

export function TripOverview(): JSX.Element {
	const { trip } = useData();
	const { goTo } = useNavigation();
	const { setHints, setTitle, clearTitle } = useLayout();
	const { setMenu } = useMenu();
	const { focus } = useFocus();

	useEffect(() => {
		setTitle(tripTitle(trip));
		return () => clearTitle();
	}, [setTitle, clearTitle, trip]);

	useEffect(() => {
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const tripName = trip.settings.name;

		setMenu(
			[
				{ label: "Owners", value: "owners", key: "o" },
				{ label: "Accounts", value: "accounts", key: "a" },
				{ label: "Expenses", value: "expenses", key: "p" },
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
			{ key: "↑↓", label: "Scroll" },
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

	return (
		<TripDashboard
			status={getTripStatus(trip, today())}
			isActive={focus === "main"}
		/>
	);
}
