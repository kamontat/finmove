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
import { CategoryDelete } from "./screens/CategoryDelete";
import { CategoryEdit } from "./screens/CategoryEdit";
import { CategoryList } from "./screens/CategoryList";
import { CategorySelect } from "./screens/CategorySelect";
import { CountryCreate } from "./screens/CountryCreate";
import { CountryDelete } from "./screens/CountryDelete";
import { CountryEdit } from "./screens/CountryEdit";
import { CountryList } from "./screens/CountryList";
import { CurrencyCreate } from "./screens/CurrencyCreate";
import { CurrencyDelete } from "./screens/CurrencyDelete";
import { CurrencyEdit } from "./screens/CurrencyEdit";
import { CurrencyList } from "./screens/CurrencyList";
import { CurrencySelect } from "./screens/CurrencySelect";
import { ExpenseDelete } from "./screens/ExpenseDelete";
import { ExpenseDuplicateSelect } from "./screens/ExpenseDuplicateSelect";
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
import { TagDelete } from "./screens/TagDelete";
import { TagEdit } from "./screens/TagEdit";
import { TagList } from "./screens/TagList";
import { TagSelect } from "./screens/TagSelect";
import { TripCreateCountryAdd } from "./screens/TripCreateCountryAdd";
import { TripCreateCountryDelete } from "./screens/TripCreateCountryDelete";
import { TripCreateCountryList } from "./screens/TripCreateCountryList";
import { TripDelete } from "./screens/TripDelete";
import { TripDuplicateSelect } from "./screens/TripDuplicateSelect";
import { TripForm } from "./screens/TripForm";
import { TripList } from "./screens/TripList";
import { TripOverview } from "./screens/TripOverview";
import { TripSettings } from "./screens/TripSettings";

export const routes: Routes = {
	"/trips": {
		component: TripList as unknown as ComponentType,
		title: "Trips",
	},
	"/trips/delete": {
		component: TripDelete as unknown as ComponentType,
		title: "Delete Trip",
	},
	"/trips/new": {
		component: TripForm as unknown as ComponentType,
		title: "New Trip",
	},
	"/trips/new/countries": {
		component: TripCreateCountryList as unknown as ComponentType,
		title: "Countries",
	},
	"/trips/new/countries/new": {
		component: TripCreateCountryAdd as unknown as ComponentType,
		title: "New Country",
	},
	"/trips/new/countries/delete": {
		component: TripCreateCountryDelete as unknown as ComponentType,
		title: "Delete Country",
	},
	"/trips/duplicate": {
		component: TripDuplicateSelect as unknown as ComponentType,
		title: "Duplicate Trip",
	},
	"/trips/overview": {
		component: TripOverview as unknown as ComponentType,
		title: (props) => props.tripName ?? "Trip Overview",
	},
	"/trips/owners": {
		component: OwnerList as unknown as ComponentType,
		title: "Owners",
	},
	"/trips/owners/new": {
		component: OwnerCreate as unknown as ComponentType,
		title: "Owner",
	},
	"/trips/owners/edit": {
		component: OwnerEdit as unknown as ComponentType,
		title: "Owner",
	},
	"/trips/owners/delete": {
		component: OwnerDelete as unknown as ComponentType,
		title: "Delete Owner",
	},
	"/trips/owners/references": {
		component: OwnerReferences as unknown as ComponentType,
		title: "References",
	},
	"/trips/accounts": {
		component: AccountList as unknown as ComponentType,
		title: "Accounts",
	},
	"/trips/accounts/new": {
		component: AccountCreate as unknown as ComponentType,
		title: "Account",
	},
	"/trips/accounts/edit": {
		component: AccountEdit as unknown as ComponentType,
		title: "Account",
	},
	"/trips/accounts/delete": {
		component: AccountDelete as unknown as ComponentType,
		title: "Delete Account",
	},
	"/trips/accounts/references": {
		component: AccountReferences as unknown as ComponentType,
		title: "References",
	},
	"/trips/accounts/new/owners": {
		component: OwnerSelect as unknown as ComponentType,
		title: "Select Owners",
	},
	"/trips/accounts/edit/owners": {
		component: OwnerSelect as unknown as ComponentType,
		title: "Select Owners",
	},
	"/trips/accounts/new/type": {
		component: AccountTypeSelect as unknown as ComponentType,
		title: "Select Account Type",
	},
	"/trips/accounts/edit/type": {
		component: AccountTypeSelect as unknown as ComponentType,
		title: "Select Account Type",
	},
	"/trips/expenses": {
		component: ExpenseList as unknown as ComponentType,
		title: "Expenses",
	},
	"/trips/expenses/delete": {
		component: ExpenseDelete as unknown as ComponentType,
		title: "Delete Expense",
	},
	"/trips/expenses/duplicate": {
		component: ExpenseDuplicateSelect as unknown as ComponentType,
		title: "Duplicate Expense",
	},
	"/trips/expenses/form": {
		component: ExpenseForm as unknown as ComponentType,
		title: "Expense",
	},
	"/trips/expenses/form/owners": {
		component: OwnerSelect as unknown as ComponentType,
		title: "Select Owners",
	},
	"/trips/expenses/form/tags": {
		component: TagSelect as unknown as ComponentType,
		title: "Select Tags",
	},
	"/trips/expenses/form/account": {
		component: AccountSelect as unknown as ComponentType,
		title: "Select Account",
	},
	"/trips/expenses/form/category": {
		component: CategorySelect as unknown as ComponentType,
		title: "Select Category",
	},
	"/trips/expenses/form/currency": {
		component: CurrencySelect as unknown as ComponentType,
		title: "Select Currency",
	},
	"/trips/settings": {
		component: TripSettings as unknown as ComponentType,
		title: (props) => props.tripName ?? "Settings",
	},
	"/trips/settings/countries": {
		component: CountryList as unknown as ComponentType,
		title: (props) => props.tripName ?? "Countries",
	},
	"/trips/settings/countries/delete": {
		component: CountryDelete as unknown as ComponentType,
		title: (props) => props.tripName ?? "Country",
	},
	"/trips/settings/countries/new": {
		component: CountryCreate as unknown as ComponentType,
		title: (props) => props.tripName ?? "Country",
	},
	"/trips/settings/countries/edit": {
		component: CountryEdit as unknown as ComponentType,
		title: (props) => props.tripName ?? "Country",
	},
	"/trips/settings/categories": {
		component: CategoryList as unknown as ComponentType,
		title: (props) => props.tripName ?? "Categories",
	},
	"/trips/settings/categories/delete": {
		component: CategoryDelete as unknown as ComponentType,
		title: (props) => props.tripName ?? "Category",
	},
	"/trips/settings/categories/new": {
		component: CategoryCreate as unknown as ComponentType,
		title: (props) => props.tripName ?? "Category",
	},
	"/trips/settings/categories/edit": {
		component: CategoryEdit as unknown as ComponentType,
		title: (props) => props.tripName ?? "Category",
	},
	"/trips/settings/tags": {
		component: TagList as unknown as ComponentType,
		title: (props) => props.tripName ?? "Tags",
	},
	"/trips/settings/tags/delete": {
		component: TagDelete as unknown as ComponentType,
		title: (props) => props.tripName ?? "Tag",
	},
	"/trips/settings/tags/new": {
		component: TagCreate as unknown as ComponentType,
		title: (props) => props.tripName ?? "Tag",
	},
	"/trips/settings/tags/edit": {
		component: TagEdit as unknown as ComponentType,
		title: (props) => props.tripName ?? "Tag",
	},
	"/trips/settings/currencies": {
		component: CurrencyList as unknown as ComponentType,
		title: (props) => props.tripName ?? "Currencies",
	},
	"/trips/settings/currencies/delete": {
		component: CurrencyDelete as unknown as ComponentType,
		title: (props) => props.tripName ?? "Currency",
	},
	"/trips/settings/currencies/new": {
		component: CurrencyCreate as unknown as ComponentType,
		title: (props) => props.tripName ?? "Currency",
	},
	"/trips/settings/currencies/edit": {
		component: CurrencyEdit as unknown as ComponentType,
		title: (props) => props.tripName ?? "Currency",
	},
	"/trips/settings/export": {
		component: ExportScreen as unknown as ComponentType,
		title: (props) => props.tripName ?? "Export CSV",
	},
};
