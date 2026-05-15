import type { Trip } from "../../core/models";
import type { TitleSegment } from "../models";

export function tripTitle(
	trip: Trip | null | undefined,
	...rest: TitleSegment[]
): TitleSegment[] {
	return ["Trips", trip?.settings.name, ...rest];
}

export function settingsTitle(
	trip: Trip | null | undefined,
	...rest: TitleSegment[]
): TitleSegment[] {
	return [...tripTitle(trip), "Settings", ...rest];
}
