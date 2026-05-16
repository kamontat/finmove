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
import { ExpenseListSort } from "./screens/ExpenseListSort";
import { ExportScreen } from "./screens/Export";
import { NotificationList } from "./screens/NotificationList";
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
import { TripBroken } from "./screens/TripBroken";
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
		component: TripList,
	},
	"/trips/delete": {
		component: TripDelete,
	},
	"/trips/broken": {
		component: TripBroken,
	},
	"/trips/new": {
		component: TripForm,
	},
	"/trips/new/countries": {
		component: TripCreateCountryList,
		defaultFocus: "menu",
	},
	"/trips/new/countries/new": {
		component: TripCreateCountryAdd,
	},
	"/trips/new/countries/delete": {
		component: TripCreateCountryDelete,
	},
	"/trips/duplicate": {
		component: TripDuplicateSelect,
	},
	"/notifications": {
		component: NotificationList,
	},
	"/trips/overview": {
		component: TripOverview,
		defaultFocus: "menu",
	},
	"/trips/owners": {
		component: OwnerList,
	},
	"/trips/owners/new": {
		component: OwnerCreate,
	},
	"/trips/owners/edit": {
		component: OwnerEdit,
	},
	"/trips/owners/delete": {
		component: OwnerDelete,
	},
	"/trips/owners/references": {
		component: OwnerReferences,
	},
	"/trips/accounts": {
		component: AccountList,
	},
	"/trips/accounts/new": {
		component: AccountCreate,
	},
	"/trips/accounts/edit": {
		component: AccountEdit,
	},
	"/trips/accounts/delete": {
		component: AccountDelete,
	},
	"/trips/accounts/references": {
		component: AccountReferences,
	},
	"/trips/accounts/new/owners": {
		component: OwnerSelect,
	},
	"/trips/accounts/edit/owners": {
		component: OwnerSelect,
	},
	"/trips/accounts/new/type": {
		component: AccountTypeSelect,
	},
	"/trips/accounts/edit/type": {
		component: AccountTypeSelect,
	},
	"/trips/expenses": {
		component: ExpenseList,
	},
	"/trips/expenses/delete": {
		component: ExpenseDelete,
	},
	"/trips/expenses/duplicate": {
		component: ExpenseDuplicateSelect,
	},
	"/trips/expenses/sort": {
		component: ExpenseListSort,
	},
	"/trips/expenses/form": {
		component: ExpenseForm,
	},
	"/trips/expenses/form/owners": {
		component: OwnerSelect,
	},
	"/trips/expenses/form/tags": {
		component: TagSelect,
	},
	"/trips/expenses/form/account": {
		component: AccountSelect,
	},
	"/trips/expenses/form/category": {
		component: CategorySelect,
	},
	"/trips/expenses/form/currency": {
		component: CurrencySelect,
	},
	"/trips/settings": {
		component: TripSettings,
	},
	"/trips/settings/countries": {
		component: CountryList,
		defaultFocus: "menu",
	},
	"/trips/settings/countries/delete": {
		component: CountryDelete,
	},
	"/trips/settings/countries/new": {
		component: CountryCreate,
	},
	"/trips/settings/countries/edit": {
		component: CountryEdit,
	},
	"/trips/settings/categories": {
		component: CategoryList,
		defaultFocus: "menu",
	},
	"/trips/settings/categories/delete": {
		component: CategoryDelete,
	},
	"/trips/settings/categories/new": {
		component: CategoryCreate,
	},
	"/trips/settings/categories/edit": {
		component: CategoryEdit,
	},
	"/trips/settings/tags": {
		component: TagList,
		defaultFocus: "menu",
	},
	"/trips/settings/tags/delete": {
		component: TagDelete,
	},
	"/trips/settings/tags/new": {
		component: TagCreate,
	},
	"/trips/settings/tags/edit": {
		component: TagEdit,
	},
	"/trips/settings/currencies": {
		component: CurrencyList,
		defaultFocus: "menu",
	},
	"/trips/settings/currencies/delete": {
		component: CurrencyDelete,
	},
	"/trips/settings/currencies/new": {
		component: CurrencyCreate,
	},
	"/trips/settings/currencies/edit": {
		component: CurrencyEdit,
	},
	"/trips/settings/export": {
		component: ExportScreen,
		defaultFocus: "menu",
	},
};
