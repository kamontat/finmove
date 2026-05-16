import type { JSX } from "react";
import type {
	FieldValue,
	FormFieldStrategy,
	FormFieldStrategyEditorProps,
	TextFormField,
} from "../../models";
import { TextInput } from "../atoms/TextInput";

function stringValuesOnly(
	values: Record<string, FieldValue>,
): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(values)) {
		if (typeof v === "string") out[k] = v;
	}
	return out;
}

function resolvePlaceholder(
	field: TextFormField,
	allValues: Record<string, FieldValue>,
): string | undefined {
	if (field.placeholder === undefined) return undefined;
	return typeof field.placeholder === "function"
		? field.placeholder(stringValuesOnly(allValues))
		: field.placeholder;
}

export const FormFieldText = ({
	field,
	value,
	allValues,
	onSubmit,
	onCancel,
}: FormFieldStrategyEditorProps<TextFormField>): JSX.Element => {
	const placeholder = resolvePlaceholder(field, allValues);
	const currentString = typeof value === "string" ? value : "";
	const defaultValue =
		currentString !== "" ? currentString : field.defaultValue;
	return (
		<TextInput
			{...(placeholder !== undefined ? { placeholder } : {})}
			{...(defaultValue !== undefined ? { defaultValue } : {})}
			onSubmit={onSubmit}
			onCancel={onCancel}
		/>
	);
};

export const formFieldTextStrategy: FormFieldStrategy<TextFormField> = {
	emptyValue: "",

	hasUserValue(value) {
		return typeof value === "string" && value !== "";
	},

	isFilled(field, value) {
		if (typeof value === "string" && value !== "") return true;
		return field.defaultValue !== undefined;
	},

	normalizeForSubmit(field, value) {
		if (typeof value === "string" && value !== "") return value;
		if (field.defaultValue !== undefined) return field.defaultValue;
		return "";
	},

	getDisplay(_field, value) {
		return typeof value === "string" ? value : "";
	},

	getPreview(field, allValues) {
		if (field.defaultValue !== undefined) return field.defaultValue;
		return resolvePlaceholder(field, allValues);
	},

	onEnterPress() {
		return "edit";
	},

	Editor: FormFieldText,
};
