import type { JSX } from "react";
import type {
	DateFormField,
	FormFieldStrategy,
	FormFieldStrategyEditorProps,
} from "../../models";
import { DateInput } from "../atoms/DateInput";

export const FormFieldDate = ({
	field,
	value,
	onSubmit,
	onCancel,
}: FormFieldStrategyEditorProps<DateFormField>): JSX.Element => {
	const defaultValue =
		typeof value === "string" && value !== ""
			? value
			: (field.defaultValue ?? "2026-01-01");
	return (
		<DateInput
			defaultValue={defaultValue}
			onSubmit={onSubmit}
			onCancel={onCancel}
		/>
	);
};

export const formFieldDateStrategy: FormFieldStrategy<DateFormField> = {
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

	getPreview(field) {
		return field.defaultValue;
	},

	onEnterPress() {
		return "edit";
	},

	Editor: FormFieldDate,
};
