import type { ComponentType } from "react";
import type { Routes } from "./models";
import { AccountCreate } from "./screens/AccountCreate";
import { AccountDelete } from "./screens/AccountDelete";
import { AccountEdit } from "./screens/AccountEdit";
import { AccountList } from "./screens/AccountList";
import { AccountReferences } from "./screens/AccountReferences";
import { AccountSelect } from "./screens/AccountSelect";
import { AccountTypeSelect } from "./screens/AccountTypeSelect";
import { CategoryCreate } from "./screens/CategoryCreate";
import { CategoryEdit } from "./screens/CategoryEdit";
import { CategoryList } from "./screens/CategoryList";
import { CategorySelect } from "./screens/CategorySelect";
import { CountryCreate } from "./screens/CountryCreate";
import { CountryEdit } from "./screens/CountryEdit";
import { CountryList } from "./screens/CountryList";
import { CurrencyCreate } from "./screens/CurrencyCreate";
import { CurrencyEdit } from "./screens/CurrencyEdit";
import { CurrencyList } from "./screens/CurrencyList";
import { CurrencySelect } from "./screens/CurrencySelect";
import { ExpenseForm } from "./screens/ExpenseForm";
import { ExpenseList } from "./screens/ExpenseList";
import { ExportScreen } from "./screens/Export";
import { OwnerCreate } from "./screens/OwnerCreate";
import { OwnerDelete } from "./screens/OwnerDelete";
import { OwnerEdit } from "./screens/OwnerEdit";
import { OwnerList } from "./screens/OwnerList";
import { OwnerReferences } from "./screens/OwnerReferences";
import { OwnerSelect } from "./screens/OwnerSelect";
import { TagCreate } from "./screens/TagCreate";
import { TagEdit } from "./screens/TagEdit";
import { TagList } from "./screens/TagList";
import { TagSelect } from "./screens/TagSelect";
import { TripCreate } from "./screens/TripCreate";
import { TripCreateCountryAdd } from "./screens/TripCreateCountryAdd";
import { TripCreateCountryList } from "./screens/TripCreateCountryList";
import { TripDuplicateForm } from "./screens/TripDuplicateForm";
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
	"/trips/new/countries": {
		component: TripCreateCountryList as unknown as ComponentType,
		title: "Countries",
		defaultFocus: "menu",
	},
	"/trips/new/countries/new": {
		component: TripCreateCountryAdd as unknown as ComponentType,
		title: "New Country",
		defaultFocus: "main",
	},
	"/trips/duplicate/new": {
		component: TripDuplicateForm as unknown as ComponentType,
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
		defaultFocus: "main",
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
	"/trips/owners/delete": {
		component: OwnerDelete as unknown as ComponentType,
		title: "Delete Owner",
		defaultFocus: "main",
	},
	"/trips/owners/references": {
		component: OwnerReferences as unknown as ComponentType,
		title: "References",
		defaultFocus: "main",
	},
	"/trips/accounts": {
		component: AccountList as unknown as ComponentType,
		title: "Accounts",
		defaultFocus: "main",
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
	"/trips/accounts/delete": {
		component: AccountDelete as unknown as ComponentType,
		title: "Delete Account",
		defaultFocus: "main",
	},
	"/trips/accounts/references": {
		component: AccountReferences as unknown as ComponentType,
		title: "References",
		defaultFocus: "main",
	},
	"/trips/accounts/new/owners": {
		component: OwnerSelect as unknown as ComponentType,
		title: "Select Owners",
		defaultFocus: "main",
	},
	"/trips/accounts/edit/owners": {
		component: OwnerSelect as unknown as ComponentType,
		title: "Select Owners",
		defaultFocus: "main",
	},
	"/trips/accounts/new/type": {
		component: AccountTypeSelect as unknown as ComponentType,
		title: "Select Account Type",
		defaultFocus: "main",
	},
	"/trips/accounts/edit/type": {
		component: AccountTypeSelect as unknown as ComponentType,
		title: "Select Account Type",
		defaultFocus: "main",
	},
	"/trips/expenses": {
		component: ExpenseList as unknown as ComponentType,
		title: "Expenses",
		defaultFocus: "main",
	},
	"/trips/expenses/form": {
		component: ExpenseForm as unknown as ComponentType,
		title: "Expense",
		defaultFocus: "main",
	},
	"/trips/expenses/form/owners": {
		component: OwnerSelect as unknown as ComponentType,
		title: "Select Owners",
		defaultFocus: "main",
	},
	"/trips/expenses/form/tags": {
		component: TagSelect as unknown as ComponentType,
		title: "Select Tags",
		defaultFocus: "main",
	},
	"/trips/expenses/form/account": {
		component: AccountSelect as unknown as ComponentType,
		title: "Select Account",
		defaultFocus: "main",
	},
	"/trips/expenses/form/category": {
		component: CategorySelect as unknown as ComponentType,
		title: "Select Category",
		defaultFocus: "main",
	},
	"/trips/expenses/form/currency": {
		component: CurrencySelect as unknown as ComponentType,
		title: "Select Currency",
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
