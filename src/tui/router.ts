import type { ComponentType } from "react";
import type { Routes } from "./models";
import { AccountCreate } from "./screens/AccountCreate";
import { AccountEdit } from "./screens/AccountEdit";
import { AccountList } from "./screens/AccountList";
import { CategoryCreate } from "./screens/CategoryCreate";
import { CategoryEdit } from "./screens/CategoryEdit";
import { CategoryList } from "./screens/CategoryList";
import { CountryCreate } from "./screens/CountryCreate";
import { CountryEdit } from "./screens/CountryEdit";
import { CountryList } from "./screens/CountryList";
import { CurrencyCreate } from "./screens/CurrencyCreate";
import { CurrencyEdit } from "./screens/CurrencyEdit";
import { CurrencyList } from "./screens/CurrencyList";
import { ExpenseForm } from "./screens/ExpenseForm";
import { ExpenseList } from "./screens/ExpenseList";
import { ExportScreen } from "./screens/Export";
import { OwnerCreate } from "./screens/OwnerCreate";
import { OwnerEdit } from "./screens/OwnerEdit";
import { OwnerList } from "./screens/OwnerList";
import { TagCreate } from "./screens/TagCreate";
import { TagEdit } from "./screens/TagEdit";
import { TagList } from "./screens/TagList";
import { TripCreate } from "./screens/TripCreate";
import { TripDuplicate } from "./screens/TripDuplicate";
import { TripList } from "./screens/TripList";
import { TripOverview } from "./screens/TripOverview";
import { TripSettings } from "./screens/TripSettings";

export const routes: Routes = {
	"/trips": {
		component: TripList as unknown as ComponentType,
		title: "Trips",
		defaultFocus: "main",
	},
	"/trips/new": {
		component: TripCreate as unknown as ComponentType,
		title: "New Trip",
		defaultFocus: "main",
	},
	"/trips/duplicate": {
		component: TripDuplicate as unknown as ComponentType,
		title: "Duplicate Trip",
		defaultFocus: "main",
	},
	"/trips/overview": {
		component: TripOverview as unknown as ComponentType,
		title: (props) => props.tripName ?? "Trip Overview",
		defaultFocus: "menu",
	},
	"/trips/owners": {
		component: OwnerList as unknown as ComponentType,
		title: "Owners",
		defaultFocus: "menu",
	},
	"/trips/owners/new": {
		component: OwnerCreate as unknown as ComponentType,
		title: "Owner",
		defaultFocus: "main",
	},
	"/trips/owners/edit": {
		component: OwnerEdit as unknown as ComponentType,
		title: "Owner",
		defaultFocus: "main",
	},
	"/trips/accounts": {
		component: AccountList as unknown as ComponentType,
		title: "Accounts",
		defaultFocus: "menu",
	},
	"/trips/accounts/new": {
		component: AccountCreate as unknown as ComponentType,
		title: "Account",
		defaultFocus: "main",
	},
	"/trips/accounts/edit": {
		component: AccountEdit as unknown as ComponentType,
		title: "Account",
		defaultFocus: "main",
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
		title: (props) => props.tripName ?? "Settings",
		defaultFocus: "main",
	},
	"/trips/settings/countries": {
		component: CountryList as unknown as ComponentType,
		title: (props) => props.tripName ?? "Countries",
		defaultFocus: "menu",
	},
	"/trips/settings/countries/new": {
		component: CountryCreate as unknown as ComponentType,
		title: (props) => props.tripName ?? "Country",
		defaultFocus: "main",
	},
	"/trips/settings/countries/edit": {
		component: CountryEdit as unknown as ComponentType,
		title: (props) => props.tripName ?? "Country",
		defaultFocus: "main",
	},
	"/trips/settings/categories": {
		component: CategoryList as unknown as ComponentType,
		title: (props) => props.tripName ?? "Categories",
		defaultFocus: "menu",
	},
	"/trips/settings/categories/new": {
		component: CategoryCreate as unknown as ComponentType,
		title: (props) => props.tripName ?? "Category",
		defaultFocus: "main",
	},
	"/trips/settings/categories/edit": {
		component: CategoryEdit as unknown as ComponentType,
		title: (props) => props.tripName ?? "Category",
		defaultFocus: "main",
	},
	"/trips/settings/tags": {
		component: TagList as unknown as ComponentType,
		title: (props) => props.tripName ?? "Tags",
		defaultFocus: "menu",
	},
	"/trips/settings/tags/new": {
		component: TagCreate as unknown as ComponentType,
		title: (props) => props.tripName ?? "Tag",
		defaultFocus: "main",
	},
	"/trips/settings/tags/edit": {
		component: TagEdit as unknown as ComponentType,
		title: (props) => props.tripName ?? "Tag",
		defaultFocus: "main",
	},
	"/trips/settings/currencies": {
		component: CurrencyList as unknown as ComponentType,
		title: (props) => props.tripName ?? "Currencies",
		defaultFocus: "menu",
	},
	"/trips/settings/currencies/new": {
		component: CurrencyCreate as unknown as ComponentType,
		title: (props) => props.tripName ?? "Currency",
		defaultFocus: "main",
	},
	"/trips/settings/currencies/edit": {
		component: CurrencyEdit as unknown as ComponentType,
		title: (props) => props.tripName ?? "Currency",
		defaultFocus: "main",
	},
	"/trips/settings/export": {
		component: ExportScreen as unknown as ComponentType,
		title: (props) => props.tripName ?? "Export CSV",
		defaultFocus: "menu",
	},
};
