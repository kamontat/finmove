import type { Trip } from "../core/models";
import type { RouteEntry } from "./models";

export function buildBreadcrumb(route: RouteEntry, trip: Trip | null): string {
	const parts: string[] = [];

	switch (route.path) {
		case "/trips":
			parts.push("Trips");
			break;
		case "/trips/new":
			parts.push(
				"Trips",
				route.props.duplicateFromDirPath ? "Duplicate" : "New",
			);
			break;
		case "/trips/delete":
			parts.push("Trips", "Delete");
			break;
		case "/trips/duplicate":
			parts.push("Trips", "Duplicate");
			break;
		case "/notifications":
			parts.push("Notifications");
			break;
		default: {
			parts.push("Trips");
			if (trip) {
				parts.push(trip.settings.name);
			}
			switch (route.path) {
				case "/trips/owners":
					parts.push("Owners");
					break;
				case "/trips/owners/new":
					parts.push("Owners", "New");
					break;
				case "/trips/owners/edit":
					parts.push("Owners", "Edit");
					break;
				case "/trips/owners/delete":
					parts.push("Owners", "Delete");
					break;
				case "/trips/owners/references":
					parts.push("Owners", "References");
					break;
				case "/trips/accounts":
					parts.push("Accounts");
					break;
				case "/trips/accounts/new":
					parts.push("Accounts", "New");
					break;
				case "/trips/accounts/edit":
					parts.push("Accounts", "Edit");
					break;
				case "/trips/accounts/delete":
					parts.push("Accounts", "Delete");
					break;
				case "/trips/accounts/references":
					parts.push("Accounts", "References");
					break;
				case "/trips/expenses":
					parts.push("Expenses");
					break;
				case "/trips/expenses/delete":
					parts.push("Expenses", "Delete");
					break;
				case "/trips/expenses/duplicate":
					parts.push("Expenses", "Duplicate");
					break;
				case "/trips/expenses/form":
					parts.push(
						"Expenses",
						route.props.expenseId
							? "Edit"
							: route.props.duplicateFromId
								? "Duplicate"
								: "New",
					);
					break;
			}
			break;
		}
	}

	return parts.join(" > ");
}
