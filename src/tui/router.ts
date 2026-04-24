import type { ComponentType } from "react";
import type { RouteConfig, RoutePath } from "./models";
import { AccountList } from "./screens/AccountList";
import { CountryCreate } from "./screens/CountryCreate";
import { CountryEdit } from "./screens/CountryEdit";
import { CountryList } from "./screens/CountryList";
import { ExpenseForm } from "./screens/ExpenseForm";
import { ExpenseList } from "./screens/ExpenseList";
import { ExportScreen } from "./screens/Export";
import { OwnerList } from "./screens/OwnerList";
import { TagCreate } from "./screens/TagCreate";
import { TagEdit } from "./screens/TagEdit";
import { TagList } from "./screens/TagList";
import { TripList } from "./screens/TripList";
import { TripOverview } from "./screens/TripOverview";
import { TripSettings } from "./screens/TripSettings";
import { TripSettingsCategories } from "./screens/TripSettingsCategories";
import { TripSettingsCurrencies } from "./screens/TripSettingsCurrencies";

export const routes: Record<RoutePath, RouteConfig> = {
	"/trips": {
		component: TripList as unknown as ComponentType,
		title: "Trips",
		defaultFocus: "main",
	},
	"/trips/overview": {
		component: TripOverview as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Trip Overview",
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
	"/trips/settings": {
		component: TripSettings as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Settings",
		defaultFocus: "main",
	},
	"/trips/settings/countries": {
		component: CountryList as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Countries",
		defaultFocus: "menu",
	},
	"/trips/settings/countries/new": {
		component: CountryCreate as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Country",
		defaultFocus: "main",
	},
	"/trips/settings/countries/edit": {
		component: CountryEdit as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Country",
		defaultFocus: "main",
	},
	"/trips/settings/categories": {
		component: TripSettingsCategories as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Categories",
		defaultFocus: "menu",
	},
	"/trips/settings/tags": {
		component: TagList as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Tags",
		defaultFocus: "menu",
	},
	"/trips/settings/tags/new": {
		component: TagCreate as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Tag",
		defaultFocus: "main",
	},
	"/trips/settings/tags/edit": {
		component: TagEdit as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Tag",
		defaultFocus: "main",
	},
	"/trips/settings/currencies": {
		component: TripSettingsCurrencies as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Currencies",
		defaultFocus: "menu",
	},
	"/trips/settings/export": {
		component: ExportScreen as unknown as ComponentType,
		title: (props) => (props["tripName"] as string) ?? "Export CSV",
		defaultFocus: "menu",
	},
};
