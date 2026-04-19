import { Box } from "ink";
import type { JSX } from "react";
import type { Trip } from "../../core/models";
import { TextLabel } from "../components/atoms/text-label";
import { NavigationMenu } from "../components/organisms/navigation-menu";

export type TripPage = "owners" | "accounts" | "expenses" | "export";

interface TripMenuProps {
	trip: Trip;
	onNavigate: (page: TripPage) => void;
	onBack: () => void;
}

export function TripMenu({
	trip,
	onNavigate,
	onBack,
}: TripMenuProps): JSX.Element {
	const { settings } = trip;

	const options = [
		{ label: "Owners", value: "owners" },
		{ label: "Accounts", value: "accounts" },
		{ label: "Expenses", value: "expenses" },
		{ label: "Export CSV", value: "export" },
		{ label: "Back", value: "__back__" },
	];

	return (
		<Box flexDirection="column" gap={1}>
			<TextLabel text={settings.name} bold color="cyan" />
			<TextLabel
				text={`${settings.startDate} — ${settings.endDate} | ${settings.countries.join(", ")}`}
				dimColor
			/>
			<NavigationMenu
				title="Menu"
				options={options}
				onSelect={(value) => {
					if (value === "__back__") {
						onBack();
						return;
					}
					onNavigate(value as TripPage);
				}}
			/>
		</Box>
	);
}
