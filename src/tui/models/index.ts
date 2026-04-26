import type { ComponentType } from "react";

export type FocusZone = "main" | "menu" | "input";

export type FieldValue = string | string[];

export interface RouteParams {
	"/trips": { dataDir?: string; selectMode?: "delete" | "duplicate" };
	"/trips/new": { dataDir?: string };
	"/trips/duplicate": {
		dataDir?: string;
		sourceDirPath: string;
		sourceName: string;
		sourceStartDate: string;
	};
	"/trips/overview": {
		tripDirPath: string;
		tripName?: string;
		dataDir?: string;
	};

	"/trips/owners": { tripDirPath: string; selectMode?: "remove" };
	"/trips/owners/new": { tripDirPath: string };
	"/trips/owners/edit": { tripDirPath: string; ownerId: string };

	"/trips/accounts": { tripDirPath: string; selectMode?: "remove" };
	"/trips/accounts/new": { tripDirPath: string };
	"/trips/accounts/edit": { tripDirPath: string; accountId: string };

	"/trips/expenses": { tripDirPath: string; selectMode?: "remove" };
	"/trips/expenses/form": { tripDirPath: string; expenseId?: string };

	"/trips/settings": { tripDirPath: string; tripName?: string };

	"/trips/settings/countries": {
		tripDirPath: string;
		tripName?: string;
		selectMode?: "remove";
	};
	"/trips/settings/countries/new": {
		tripDirPath: string;
		tripName?: string;
	};
	"/trips/settings/countries/edit": {
		tripDirPath: string;
		tripName?: string;
		value: string;
	};

	"/trips/settings/categories": {
		tripDirPath: string;
		tripName?: string;
		selectMode?: "remove";
	};
	"/trips/settings/categories/new": {
		tripDirPath: string;
		tripName?: string;
	};
	"/trips/settings/categories/edit": {
		tripDirPath: string;
		tripName?: string;
		value: string;
	};

	"/trips/settings/tags": {
		tripDirPath: string;
		tripName?: string;
		selectMode?: "remove";
	};
	"/trips/settings/tags/new": {
		tripDirPath: string;
		tripName?: string;
	};
	"/trips/settings/tags/edit": {
		tripDirPath: string;
		tripName?: string;
		value: string;
	};

	"/trips/settings/currencies": {
		tripDirPath: string;
		tripName?: string;
		selectMode?: "remove";
	};
	"/trips/settings/currencies/new": {
		tripDirPath: string;
		tripName?: string;
	};
	"/trips/settings/currencies/edit": {
		tripDirPath: string;
		tripName?: string;
		currencyCode: string;
	};

	"/trips/settings/export": { tripDirPath: string; tripName?: string };

	"/trips/new/countries": {
		dataDir?: string;
		selectMode?: "remove";
	};
	"/trips/new/countries/new": {
		dataDir?: string;
	};

	"/trips/accounts/new/owners": {
		tripDirPath: string;
		formId: string;
		fieldKey: string;
	};
	"/trips/accounts/edit/owners": {
		tripDirPath: string;
		accountId: string;
		formId: string;
		fieldKey: string;
	};

	"/trips/expenses/form/owners": {
		tripDirPath: string;
		formId: string;
		fieldKey: string;
	};
	"/trips/expenses/form/tags": {
		tripDirPath: string;
		formId: string;
		fieldKey: string;
	};
}

export type RoutePath = keyof RouteParams;

export type RouteEntry = {
	[P in RoutePath]: { path: P; props: RouteParams[P] };
}[RoutePath];

export interface RouteConfig<P extends RoutePath = RoutePath> {
	component: ComponentType;
	title: string | ((props: RouteParams[P]) => string);
	defaultFocus: FocusZone;
	borderColor?: string;
}

export type Routes = { [P in RoutePath]: RouteConfig<P> };

export interface SelectOption {
	label: string;
	value: string;
	key?: string;
}

export interface HelpHint {
	key: string;
	label: string;
}

export interface VerticalOption {
	label: string;
	value: string;
	detail?: string;
}

// --- Form ---

interface FormFieldBase {
	key: string;
	label: string;
	required?: boolean;
}

export type TextFormField = FormFieldBase & {
	type: "text";
	defaultValue?: string;
	placeholder?: string | ((values: Record<string, string>) => string);
};

export type SelectFormField = FormFieldBase & {
	type: "select";
	options: SelectOption[];
	defaultValue?: string;
};

export type DateFormField = FormFieldBase & {
	type: "date";
	defaultValue?: string;
};

export type MultiSelectFormField = FormFieldBase & {
	type: "multiselect";
	defaultValue?: string[];
	onEdit: () => void;
	display?: (selected: string[]) => string;
};

export type FormFieldConfig =
	| TextFormField
	| SelectFormField
	| DateFormField
	| MultiSelectFormField;

export function getString(
	values: Record<string, FieldValue>,
	key: string,
): string {
	const v = values[key];
	return typeof v === "string" ? v : "";
}

export function getStringArray(
	values: Record<string, FieldValue>,
	key: string,
): string[] {
	const v = values[key];
	return Array.isArray(v) ? v : [];
}
