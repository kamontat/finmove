import type { JSX } from "react";
import type { FormFieldStrategy, SelectFormField } from "../../models";
import { SelectInput } from "../atoms/SelectInput";

export const FormFieldSelect: FormFieldStrategy<SelectFormField> = {
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

	getDisplay(field, value) {
		if (typeof value !== "string" || value === "") return "";
		const found = field.options.find((o) => o.value === value);
		return found?.label ?? value;
	},

	getPreview(field) {
		if (field.defaultValue === undefined) return undefined;
		const found = field.options.find((o) => o.value === field.defaultValue);
		return found?.label ?? field.defaultValue;
	},

	onEnterPress(field) {
		return field.onEdit ?? "edit";
	},

	Editor({ field, value, onSubmit, onCancel }): JSX.Element {
		const target =
			typeof value === "string" && value !== "" ? value : field.defaultValue;
		const initialIndex = Math.max(
			0,
			field.options.findIndex((o) => o.value === target),
		);
		return (
			<SelectInput
				options={field.options}
				isActive={true}
				initialIndex={initialIndex}
				onChange={onSubmit}
				onCancel={onCancel}
			/>
		);
	},
};
