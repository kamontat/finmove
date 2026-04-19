import type { ComponentType } from "react";
import type { RouteConfig, RoutePath } from "./models";
import { AccountList } from "./screens/AccountList";
import { ExpenseForm } from "./screens/ExpenseForm";
import { ExpenseList } from "./screens/ExpenseList";
import { ExportScreen } from "./screens/Export";
import { OwnerList } from "./screens/OwnerList";
import { TripList } from "./screens/TripList";
import { TripMenu } from "./screens/TripMenu";

export const routes: Record<RoutePath, RouteConfig> = {
	"/trips": {
		component: TripList as unknown as ComponentType,
		title: "Trips",
		defaultFocus: "main",
	},
	"/trips/menu": {
		component: TripMenu as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Trip Menu",
		defaultFocus: "menu",
	},
	"/trips/owners": {
		component: OwnerList as unknown as ComponentType,
		title: "Owners",
		defaultFocus: "menu",
	},
	"/trips/accounts": {
		component: AccountList as unknown as ComponentType,
		title: "Accounts",
		defaultFocus: "menu",
	},
	"/trips/expenses": {
		component: ExpenseList as unknown as ComponentType,
		title: "Expenses",
		defaultFocus: "menu",
	},
	"/trips/expenses/form": {
		component: ExpenseForm as unknown as ComponentType,
		title: "Expense",
		defaultFocus: "main",
	},
	"/trips/export": {
		component: ExportScreen as unknown as ComponentType,
		title: "Export CSV",
		defaultFocus: "main",
	},
};
