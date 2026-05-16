import type { JSX } from "react";
import type {
	FieldValue,
	FormFieldStrategy,
	FormFieldStrategyEditorProps,
	NumberFormField,
} from "../../models";
import { NumberInput } from "../atoms/NumberInput";

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
	field: NumberFormField,
	allValues: Record<string, FieldValue>,
): string | undefined {
	if (field.placeholder === undefined) return undefined;
	return typeof field.placeholder === "function"
		? field.placeholder(stringValuesOnly(allValues))
		: field.placeholder;
}

export const FormFieldNumber = ({
	field,
	value,
	allValues,
	onSubmit,
	onCancel,
}: FormFieldStrategyEditorProps<NumberFormField>): JSX.Element => {
	const placeholder = resolvePlaceholder(field, allValues);
	const currentNumber = typeof value === "number" ? value : undefined;
	const defaultValue = currentNumber ?? field.defaultValue;
	return (
		<NumberInput
			{...(placeholder !== undefined ? { placeholder } : {})}
			{...(defaultValue !== undefined ? { defaultValue } : {})}
			onSubmit={onSubmit}
			onCancel={onCancel}
		/>
	);
};

export const formFieldNumberStrategy: FormFieldStrategy<NumberFormField> = {
	emptyValue: "",

	hasUserValue(value) {
		return typeof value === "number";
	},

	isFilled(field, value) {
		if (typeof value === "number") return true;
		return field.defaultValue !== undefined;
	},

	normalizeForSubmit(field, value) {
		if (typeof value === "number") return value;
		if (field.defaultValue !== undefined) return field.defaultValue;
		return "";
	},

	getDisplay(_field, value) {
		return typeof value === "number" ? String(value) : "";
	},

	getPreview(field, allValues) {
		if (field.defaultValue !== undefined) return String(field.defaultValue);
		return resolvePlaceholder(field, allValues);
	},

	onEnterPress() {
		return "edit";
	},

	Editor: FormFieldNumber,
};
