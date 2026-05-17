import { Box } from "ink";
import type { JSX } from "react";
import type { FormFieldStrategy, MultiSelectFormField } from "../../models";

// Never rendered: onEnterPress always returns a function, so Form skips
// the editor block for multiselect. This placeholder satisfies the
// FormFieldStrategy interface.
export const FormFieldMultiselect = (): JSX.Element => {
	return <Box />;
};

export const formFieldMultiselectStrategy: FormFieldStrategy<MultiSelectFormField> =
	{
		emptyValue: [],

		hasUserValue(value) {
			return (Array.isArray(value) && value.length > 0) || value === null;
		},

		isFilled(_field, value) {
			if (value === null) return false;
			return Array.isArray(value) && value.length > 0;
		},

		normalizeForSubmit(_field, value) {
			if (value === null) return [];
			return Array.isArray(value) ? value : [];
		},

		getDisplay(field, value) {
			if (value === null) return "(none)";
			const arr = Array.isArray(value) ? value : (field.defaultValue ?? []);
			if (field.display) return field.display(arr);
			return arr.length === 0 ? "(none)" : arr.join(", ");
		},

		getPreview() {
			return undefined;
		},

		onEnterPress(field) {
			return field.onEdit;
		},

		Editor: FormFieldMultiselect,
	};
