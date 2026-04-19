import type { ComponentType } from "react";

export type FocusZone = "main" | "menu" | "input";

export type RoutePath =
	| "/trips"
	| "/trips/menu"
	| "/trips/owners"
	| "/trips/accounts"
	| "/trips/expenses"
	| "/trips/expenses/form"
	| "/trips/export";

export interface RouteConfig {
	component: ComponentType;
	title: string | ((props: Record<string, unknown>) => string);
	defaultFocus: FocusZone;
	borderColor?: string;
}

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
	placeholder?: string;
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

export type FormFieldConfig = TextFormField | SelectFormField | DateFormField;
