import { Box, Text, useInput } from "ink";
import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import type { FormFieldConfig } from "../../models";
import { useFocus } from "../../states/focus";
import { DateInput } from "../atoms/DateInput";
import { DropdownSelect } from "../atoms/DropdownSelect";
import { InlineSelect } from "../atoms/InlineSelect";
import { TextInput } from "../atoms/TextInput";

const INLINE_SELECT_THRESHOLD = 3;

interface FormProps {
	fields: FormFieldConfig[];
	onSubmit: (values: Record<string, string>) => void;
	submitLabel?: string;
	submitKey?: string;
}

export function Form({
	fields,
	onSubmit,
	submitLabel = "Submit",
	submitKey = "s",
}: FormProps): JSX.Element {
	const { setFocus } = useFocus();

	useEffect(() => {
		setFocus("main");
	}, [setFocus]);

	const [values, setValues] = useState<Record<string, string>>(() => {
		const initial: Record<string, string> = {};
		for (const field of fields) {
			initial[field.key] = "";
		}
		return initial;
	});

	const [cursor, setCursor] = useState(0);
	const [editing, setEditing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const canSubmit = useMemo(() => {
		const allRequiredFilled = fields.every((field) => {
			if (!field.required) return true;
			const val = values[field.key] ?? "";
			return val !== "" || field.defaultValue !== undefined;
		});
		const hasAnyChange = fields.some((field) => {
			const val = values[field.key] ?? "";
			return val !== "";
		});
		return allRequiredFilled && hasAnyChange;
	}, [fields, values]);

	const totalItems = canSubmit ? fields.length + 1 : fields.length;

	// Clamp cursor if submit row becomes unavailable
	if (cursor >= totalItems) {
		setCursor(totalItems - 1);
	}

	const handleSubmit = useCallback(() => {
		if (!canSubmit) return;
		const result: Record<string, string> = {};
		for (const field of fields) {
			const val = values[field.key] ?? "";
			if (val !== "") {
				result[field.key] = val;
			} else if (field.defaultValue !== undefined) {
				result[field.key] = field.defaultValue;
			} else {
				result[field.key] = "";
			}
		}
		try {
			onSubmit(result);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, [canSubmit, fields, values, onSubmit]);

	const enterEdit = useCallback(() => {
		setError(null);
		setEditing(true);
		setFocus("input");
	}, [setFocus]);

	const exitEdit = useCallback(() => {
		setEditing(false);
		setFocus("main");
	}, [setFocus]);

	const setValue = useCallback(
		(key: string, value: string) => {
			setValues((prev) => ({ ...prev, [key]: value }));
			exitEdit();
		},
		[exitEdit],
	);

	const cancelEdit = useCallback(() => {
		exitEdit();
	}, [exitEdit]);

	// Only handle form-specific keys (navigation, editing, submit).
	// Global shortcuts ([q], [esc], [e], [?], [tab]) are handled by useGlobalKeys.
	useInput(
		(_input, key) => {
			if (key.upArrow) {
				setCursor((c) => (c > 0 ? c - 1 : totalItems - 1));
			} else if (key.downArrow) {
				setCursor((c) => (c < totalItems - 1 ? c + 1 : 0));
			} else if (key.return) {
				if (cursor === fields.length) {
					handleSubmit();
				} else {
					enterEdit();
				}
			} else if (_input === submitKey && canSubmit) {
				handleSubmit();
			}
		},
		{ isActive: !editing },
	);

	return (
		<Box flexDirection="column">
			{fields.map((field, index) => {
				const isCursor = cursor === index;
				const currentValue = values[field.key] ?? "";
				const isEditing = editing && isCursor;

				// Determine display label for the value
				let displayValue = currentValue;
				if (field.type === "select" && currentValue !== "") {
					const found = field.options.find((o) => o.value === currentValue);
					displayValue = found?.label ?? currentValue;
				}

				const hasValue = currentValue !== "";
				const optionalSuffix = !field.required ? " (optional)" : "";

				// Preview shown when the user hasn't touched the field.
				// Prefer defaultValue (existing data in edit mode) over placeholder
				// (input hint) so edit forms are distinguishable from add forms.
				let preview: string | undefined;
				if (field.defaultValue !== undefined) {
					if (field.type === "select") {
						const found = field.options.find(
							(o) => o.value === field.defaultValue,
						);
						preview = found?.label ?? field.defaultValue;
					} else {
						preview = field.defaultValue;
					}
				} else if (field.type === "text" && field.placeholder !== undefined) {
					preview = field.placeholder;
				}

				return (
					<Box key={field.key} flexDirection="column">
						{/* Label row */}
						<Text>
							{isCursor ? (
								<Text color="cyan" bold>
									{">"} {field.label}
									{optionalSuffix}:{" "}
									{hasValue
										? displayValue
										: preview !== undefined
											? `(${preview})`
											: ""}
								</Text>
							) : (
								<Text dimColor>
									{"  "}
									{field.label}
									{optionalSuffix}:{" "}
									{hasValue
										? displayValue
										: preview !== undefined
											? `(${preview})`
											: ""}
								</Text>
							)}
						</Text>

						{/* Edit row — shown only when this field is being edited */}
						{isEditing && (
							<Box marginLeft={4}>
								{field.type === "text" && (
									<TextInput
										{...(field.placeholder !== undefined
											? { placeholder: field.placeholder }
											: {})}
										{...(currentValue !== ""
											? { defaultValue: currentValue }
											: field.defaultValue !== undefined
												? { defaultValue: field.defaultValue }
												: {})}
										onSubmit={(val) => setValue(field.key, val)}
										onCancel={cancelEdit}
									/>
								)}
								{field.type === "date" && (
									<DateInput
										defaultValue={
											currentValue !== ""
												? currentValue
												: (field.defaultValue ?? "2026-01-01")
										}
										onSubmit={(val) => setValue(field.key, val)}
										onCancel={cancelEdit}
									/>
								)}
								{field.type === "select" &&
									field.options.length <= INLINE_SELECT_THRESHOLD && (
										<InlineSelect
											options={field.options}
											{...(currentValue !== ""
												? { defaultValue: currentValue }
												: field.defaultValue !== undefined
													? { defaultValue: field.defaultValue }
													: {})}
											onSubmit={(val) => setValue(field.key, val)}
											onCancel={cancelEdit}
										/>
									)}
								{field.type === "select" &&
									field.options.length > INLINE_SELECT_THRESHOLD && (
										<DropdownSelect
											options={field.options}
											{...(currentValue !== ""
												? { defaultValue: currentValue }
												: field.defaultValue !== undefined
													? { defaultValue: field.defaultValue }
													: {})}
											onSubmit={(val) => setValue(field.key, val)}
											onCancel={cancelEdit}
										/>
									)}
							</Box>
						)}
					</Box>
				);
			})}

			{/* Separator */}
			<Box marginTop={1}>
				<Text dimColor>{"─".repeat(20)}</Text>
			</Box>

			{/* Submit button */}
			<Box>
				{cursor === fields.length ? (
					<Text
						bold
						inverse={canSubmit}
						{...(canSubmit ? { color: "green" } : {})}
						dimColor={!canSubmit}
					>
						{"  "}[{submitKey}] {submitLabel}
						{"  "}
					</Text>
				) : (
					<Text dimColor={!canSubmit}>
						{"  "}[{submitKey}] {submitLabel}
					</Text>
				)}
			</Box>

			{/* Error from onSubmit (e.g. validation throw) */}
			{error && (
				<Box marginTop={1}>
					<Text color="red">⚠ {error}</Text>
				</Box>
			)}
		</Box>
	);
}
