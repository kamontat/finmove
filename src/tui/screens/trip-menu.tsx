import { Box } from "ink";
import type { JSX } from "react";
import type { Trip } from "../../core/models";
import { TextLabel } from "../components/atoms/text-label";
import { NavigationMenu } from "../components/organisms/navigation-menu";

export type TripPage = "owners" | "accounts" | "expenses" | "export";

interface TripMenuProps {
	trip: Trip;
	onNavigate: (page: TripPage) => void;
}

export function TripMenu({ trip, onNavigate }: TripMenuProps): JSX.Element {
	const { settings } = trip;

	const options = [
		{ label: "Owners", value: "owners", key: "o" },
		{ label: "Accounts", value: "accounts", key: "a" },
		{ label: "Expenses", value: "expenses", key: "e" },
		{ label: "Export CSV", value: "export", key: "x" },
	];

	return (
		<Box flexDirection="column" gap={1}>
			<TextLabel text={settings.name} bold color="cyan" />
			<TextLabel
				text={`${settings.startDate} — ${settings.endDate} | ${settings.countries.join(", ")}`}
				dimColor
			/>
			<NavigationMenu
				options={options}
				onSelect={(value) => {
					onNavigate(value as TripPage);
				}}
			/>
		</Box>
	);
}
