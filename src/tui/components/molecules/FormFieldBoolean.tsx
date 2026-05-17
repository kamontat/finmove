import type { JSX } from "react";
import type {
	BooleanFormField,
	FormFieldStrategy,
	FormFieldStrategyEditorProps,
} from "../../models";
import { CheckboxInput } from "../atoms/CheckboxInput";

function labelFor(field: BooleanFormField, value: boolean): string {
	return value ? (field.trueLabel ?? "Yes") : (field.falseLabel ?? "No");
}

export const FormFieldBoolean = ({
	field,
	value,
	onSubmit,
	onCancel,
}: FormFieldStrategyEditorProps<BooleanFormField>): JSX.Element => {
	const defaultValue =
		typeof value === "boolean" ? value : (field.defaultValue ?? false);
	return (
		<CheckboxInput
			defaultValue={defaultValue}
			{...(field.trueLabel !== undefined ? { trueLabel: field.trueLabel } : {})}
			{...(field.falseLabel !== undefined
				? { falseLabel: field.falseLabel }
				: {})}
			onSubmit={onSubmit}
			onCancel={onCancel}
		/>
	);
};

export const formFieldBooleanStrategy: FormFieldStrategy<BooleanFormField> = {
	emptyValue: "",

	hasUserValue(value) {
		return typeof value === "boolean" || value === null;
	},

	isFilled(field, value) {
		if (typeof value === "boolean") return true;
		if (value === null) return false;
		return field.defaultValue !== undefined;
	},

	normalizeForSubmit(field, value) {
		if (typeof value === "boolean") return value;
		if (value === null) return false;
		if (field.defaultValue !== undefined) return field.defaultValue;
		return false;
	},

	getDisplay(field, value) {
		if (typeof value !== "boolean") return "";
		return labelFor(field, value);
	},

	getPreview(field, allValues) {
		if (allValues[field.key] === null) return undefined;
		if (field.defaultValue === undefined) return undefined;
		return labelFor(field, field.defaultValue);
	},

	onEnterPress() {
		return "edit";
	},

	Editor: FormFieldBoolean,
};
