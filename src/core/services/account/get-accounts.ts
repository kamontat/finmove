import type { Account, Trip } from "../../models";
export function getAccounts(trip: Trip): Account[] {
	return trip.accounts;
}
