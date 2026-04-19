import type { Owner, Trip } from "../../models";

export function getOwners(trip: Trip): Owner[] {
	return trip.owners;
}
