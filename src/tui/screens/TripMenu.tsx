import { Text } from "ink";
import type { JSX } from "react";
import type { Trip } from "../../core/models";

interface TripMenuProps {
	trip: Trip;
}

export function TripMenu({ trip }: TripMenuProps): JSX.Element {
	const { settings } = trip;
	return (
		<Text dimColor>
			{settings.startDate} — {settings.endDate} |{" "}
			{settings.countries.join(", ")}
		</Text>
	);
}
