import type { ComponentType } from "react";

export type FocusZone = "main" | "menu" | "input";

export type FieldValue = string | string[] | boolean | number;

export type NotificationSeverity = "info" | "warn" | "error";

export interface NotificationContext {
	path: string;
	trip?: string;
	severity: NotificationSeverity;
	firedAt: Date;
}

export interface Notification {
	id: string;
	text: string;
	context: NotificationContext;
}

export interface RouteParams {
	"/trips": { dataDir?: string };
	"/trips/duplicate": { dataDir?: string };
	"/trips/delete": { dataDir?: string };
	"/notifications": Record<string, never>;
	"/trips/broken": {
		dirName: string;
		dirPath: string;
		error: import("../../core/configs").ConfigError;
		dataDir?: string;
	};
	"/trips/new": { dataDir?: string; duplicateFromDirPath?: string };
	"/trips/overview": {
		tripDirPath: string;
		tripName?: string;
		dataDir?: string;
	};

	"/trips/owners": { tripDirPath: string };
	"/trips/owners/new": { tripDirPath: string };
	"/trips/owners/edit": { tripDirPath: string; ownerId: string };
	"/trips/owners/delete": { tripDirPath: string };
	"/trips/owners/references": { tripDirPath: string; ownerId: string };

	"/trips/accounts": { tripDirPath: string };
	"/trips/accounts/new": { tripDirPath: string };
	"/trips/accounts/edit": { tripDirPath: string; accountId: string };
	"/trips/accounts/delete": { tripDirPath: string };
	"/trips/accounts/references": { tripDirPath: string; accountId: string };

	"/trips/expenses": {
		tripDirPath: string;
	};
	"/trips/expenses/duplicate": {
		tripDirPath: string;
	};
	"/trips/expenses/delete": {
		tripDirPath: string;
	};
	"/trips/expenses/form": {
		tripDirPath: string;
		expenseId?: string;
		duplicateFromId?: string;
	};

	"/trips/settings": { tripDirPath: string; tripName?: string };

	"/trips/settings/countries": {
		tripDirPath: string;
		tripName?: string;
	};
	"/trips/settings/countries/delete": {
		tripDirPath: string;
		tripName?: string;
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
	};
	"/trips/settings/categories/delete": {
		tripDirPath: string;
		tripName?: string;
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
	};
	"/trips/settings/tags/delete": {
		tripDirPath: string;
		tripName?: string;
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
	};
	"/trips/settings/currencies/delete": {
		tripDirPath: string;
		tripName?: string;
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
		formId?: string;
	};
	"/trips/new/countries/delete": {
		dataDir?: string;
		formId?: string;
	};
	"/trips/new/countries/new": {
		dataDir?: string;
		formId?: string;
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

	"/trips/expenses/form/account": {
		tripDirPath: string;
		formId: string;
		fieldKey: string;
	};
	"/trips/expenses/form/category": {
		tripDirPath: string;
		formId: string;
		fieldKey: string;
	};
	"/trips/expenses/form/currency": {
		tripDirPath: string;
		formId: string;
		fieldKey: string;
	};
	"/trips/accounts/new/type": {
		tripDirPath: string;
		formId: string;
		fieldKey: string;
	};
	"/trips/accounts/edit/type": {
		tripDirPath: string;
		accountId: string;
		formId: string;
		fieldKey: string;
	};
}

export type RoutePath = keyof RouteParams;

export type RouteEntry = {
	[P in RoutePath]: { path: P; props: RouteParams[P] };
}[RoutePath];

export interface RouteConfig {
	component: ComponentType;
	defaultFocus?: FocusZone;
}

export type Routes = { [P in RoutePath]: RouteConfig };

export interface SelectOption {
	label: string;
	value: string;
	key?: string;
}

export interface HelpHint {
	key: string;
	label: string;
}

export type TitleSegment = string | null | undefined | false;

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
	editable?: boolean;
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
	onEdit?: () => void;
};

export type BooleanFormField = FormFieldBase & {
	type: "boolean";
	defaultValue?: boolean;
	trueLabel?: string;
	falseLabel?: string;
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

export type NumberFormField = FormFieldBase & {
	type: "number";
	defaultValue?: number;
	placeholder?: string | ((values: Record<string, string>) => string);
};

export type FormFieldConfig =
	| TextFormField
	| SelectFormField
	| BooleanFormField
	| DateFormField
	| MultiSelectFormField
	| NumberFormField;

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

export function getBoolean(
	values: Record<string, FieldValue>,
	key: string,
): boolean {
	const v = values[key];
	return typeof v === "boolean" ? v : false;
}

export function getNumber(
	values: Record<string, FieldValue>,
	key: string,
): number | undefined {
	const v = values[key];
	return typeof v === "number" ? v : undefined;
}

// --- Form field strategies ---

export interface FormFieldStrategyEditorProps<F extends FormFieldConfig> {
	field: F;
	value: FieldValue;
	allValues: Record<string, FieldValue>;
	onSubmit: (value: FieldValue) => void;
	onCancel: () => void;
}

export interface FormFieldStrategy<
	F extends FormFieldConfig = FormFieldConfig,
> {
	emptyValue: FieldValue;
	hasUserValue(value: FieldValue): boolean;
	isFilled(field: F, value: FieldValue): boolean;
	normalizeForSubmit(field: F, value: FieldValue): FieldValue;
	getDisplay(
		field: F,
		value: FieldValue,
		allValues: Record<string, FieldValue>,
	): string;
	getPreview(
		field: F,
		allValues: Record<string, FieldValue>,
	): string | undefined;
	// Returns "edit" to enter inline edit mode, or a function to invoke externally
	// (used by select with onEdit, and multiselect). The strategy encapsulates the
	// onEdit lookup so Form.tsx never branches on field.type.
	onEnterPress(field: F): "edit" | (() => void);
	Editor: (
		props: FormFieldStrategyEditorProps<F>,
	) => import("react").JSX.Element;
}
