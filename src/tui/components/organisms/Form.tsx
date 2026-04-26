import { Box, Text, useInput } from "ink";
import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import type { FieldValue, FormFieldConfig } from "../../models";
import { useFocus } from "../../states/focus";
import { useFormBuffer } from "../../states/formBuffer";
import { DateInput } from "../atoms/DateInput";
import { DropdownSelect } from "../atoms/DropdownSelect";
import { InlineSelect } from "../atoms/InlineSelect";
import { TextInput } from "../atoms/TextInput";

const INLINE_SELECT_THRESHOLD = 3;

interface FormProps {
	fields: FormFieldConfig[];
	onSubmit: (values: Record<string, FieldValue>) => void;
	submitLabel?: string;
	submitKey?: string;
	formId?: string;
}

export function Form({
	fields,
	onSubmit,
	submitLabel = "Submit",
	submitKey = "s",
	formId,
}: FormProps): JSX.Element {
	const { setFocus } = useFocus();

	useEffect(() => {
		setFocus("main");
	}, [setFocus]);

	const buffer = useFormBuffer(formId ?? "__unused__");
	const usingBuffer = formId !== undefined;

	const [localValues, setLocalValues] = useState<Record<string, FieldValue>>(
		() => {
			const initial: Record<string, FieldValue> = {};
			for (const field of fields) {
				initial[field.key] = field.type === "multiselect" ? [] : "";
			}
			return initial;
		},
	);

	const values: Record<string, FieldValue> = usingBuffer
		? { ...localValues, ...buffer.values }
		: localValues;

	const setValue = useCallback(
		(key: string, value: FieldValue) => {
			setLocalValues((prev) => ({ ...prev, [key]: value }));
			if (usingBuffer) {
				buffer.setField(key, value);
			}
		},
		[usingBuffer, buffer],
	);

	const [cursor, setCursor] = useState(0);
	const [editing, setEditing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isFilled = useCallback(
		(field: FormFieldConfig): boolean => {
			const v = values[field.key];
			if (field.type === "multiselect") {
				return Array.isArray(v) && v.length > 0;
			}
			if (typeof v === "string" && v !== "") return true;
			return field.defaultValue !== undefined;
		},
		[values],
	);

	const canSubmit = useMemo(() => {
		const allRequiredFilled = fields.every((field) => {
			if (!field.required) return true;
			return isFilled(field);
		});
		const hasAnyChange = fields.some((field) => {
			const v = values[field.key];
			if (field.type === "multiselect") {
				return Array.isArray(v) && v.length > 0;
			}
			return typeof v === "string" && v !== "";
		});
		return allRequiredFilled && hasAnyChange;
	}, [fields, values, isFilled]);

	const totalItems = canSubmit ? fields.length + 1 : fields.length;

	if (cursor >= totalItems) {
		setCursor(totalItems - 1);
	}

	const handleSubmit = useCallback(() => {
		if (!canSubmit) return;
		const result: Record<string, FieldValue> = {};
		for (const field of fields) {
			const v = values[field.key];
			if (field.type === "multiselect") {
				const arr = Array.isArray(v) ? v : [];
				result[field.key] = arr.length > 0 ? arr : (field.defaultValue ?? []);
			} else if (typeof v === "string" && v !== "") {
				result[field.key] = v;
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

	const setStringValue = useCallback(
		(key: string, value: string) => {
			setValue(key, value);
			exitEdit();
		},
		[setValue, exitEdit],
	);

	const cancelEdit = useCallback(() => {
		exitEdit();
	}, [exitEdit]);

	useInput(
		(input, key) => {
			if (key.upArrow) {
				setCursor((c) => (c > 0 ? c - 1 : totalItems - 1));
			} else if (key.downArrow) {
				setCursor((c) => (c < totalItems - 1 ? c + 1 : 0));
			} else if (key.return) {
				if (cursor === fields.length) {
					handleSubmit();
				} else {
					const field = fields[cursor];
					if (!field) return;
					if (field.type === "multiselect") {
						field.onEdit();
					} else {
						enterEdit();
					}
				}
			} else if (input === submitKey && canSubmit) {
				handleSubmit();
			}
		},
		{ isActive: !editing },
	);

	return (
		<Box flexDirection="column">
			{fields.map((field, index) => {
				const isCursor = cursor === index;
				const currentValue = values[field.key];
				const isEditing = editing && isCursor;

				let displayValue = "";
				if (field.type === "multiselect") {
					const arr = Array.isArray(currentValue)
						? currentValue
						: (field.defaultValue ?? []);
					displayValue = field.display
						? field.display(arr)
						: arr.length === 0
							? "(none)"
							: arr.join(", ");
				} else if (
					field.type === "select" &&
					typeof currentValue === "string" &&
					currentValue !== ""
				) {
					const found = field.options.find((o) => o.value === currentValue);
					displayValue = found?.label ?? currentValue;
				} else if (typeof currentValue === "string") {
					displayValue = currentValue;
				}

				const hasValue =
					field.type === "multiselect"
						? Array.isArray(currentValue) && currentValue.length > 0
						: typeof currentValue === "string" && currentValue !== "";
				const optionalSuffix = !field.required ? " (optional)" : "";

				let preview: string | undefined;
				if (field.type === "multiselect") {
					preview = undefined;
				} else if (field.defaultValue !== undefined) {
					if (field.type === "select") {
						const found = field.options.find(
							(o) => o.value === field.defaultValue,
						);
						preview = found?.label ?? (field.defaultValue as string);
					} else {
						preview = field.defaultValue as string;
					}
				} else if (field.type === "text" && field.placeholder !== undefined) {
					preview =
						typeof field.placeholder === "function"
							? field.placeholder(stringValuesOnly(values))
							: field.placeholder;
				}

				const labelText = (
					<>
						{field.label}
						{optionalSuffix}:{" "}
						{field.type === "multiselect"
							? displayValue
							: hasValue
								? displayValue
								: preview !== undefined
									? `(${preview})`
									: ""}
					</>
				);

				return (
					<Box key={field.key} flexDirection="column">
						<Text>
							{isCursor ? (
								<Text color="cyan" bold>
									{">"} {labelText}
								</Text>
							) : (
								<Text dimColor>
									{"  "}
									{labelText}
								</Text>
							)}
						</Text>

						{isEditing && field.type !== "multiselect" && (
							<Box marginLeft={4}>
								{field.type === "text" && (
									<TextInput
										{...(field.placeholder !== undefined
											? {
													placeholder:
														typeof field.placeholder === "function"
															? field.placeholder(stringValuesOnly(values))
															: field.placeholder,
												}
											: {})}
										{...(typeof currentValue === "string" && currentValue !== ""
											? { defaultValue: currentValue }
											: field.defaultValue !== undefined
												? { defaultValue: field.defaultValue }
												: {})}
										onSubmit={(val) => setStringValue(field.key, val)}
										onCancel={cancelEdit}
									/>
								)}
								{field.type === "date" && (
									<DateInput
										defaultValue={
											typeof currentValue === "string" && currentValue !== ""
												? currentValue
												: (field.defaultValue ?? "2026-01-01")
										}
										onSubmit={(val) => setStringValue(field.key, val)}
										onCancel={cancelEdit}
									/>
								)}
								{field.type === "select" &&
									field.options.length <= INLINE_SELECT_THRESHOLD && (
										<InlineSelect
											options={field.options}
											{...(typeof currentValue === "string" &&
											currentValue !== ""
												? { defaultValue: currentValue }
												: field.defaultValue !== undefined
													? { defaultValue: field.defaultValue }
													: {})}
											onSubmit={(val) => setStringValue(field.key, val)}
											onCancel={cancelEdit}
										/>
									)}
								{field.type === "select" &&
									field.options.length > INLINE_SELECT_THRESHOLD && (
										<DropdownSelect
											options={field.options}
											{...(typeof currentValue === "string" &&
											currentValue !== ""
												? { defaultValue: currentValue }
												: field.defaultValue !== undefined
													? { defaultValue: field.defaultValue }
													: {})}
											onSubmit={(val) => setStringValue(field.key, val)}
											onCancel={cancelEdit}
										/>
									)}
							</Box>
						)}
					</Box>
				);
			})}

			<Box marginTop={1}>
				<Text dimColor>{"─".repeat(20)}</Text>
			</Box>

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

			{error && (
				<Box marginTop={1}>
					<Text color="red">⚠ {error}</Text>
				</Box>
			)}
		</Box>
	);
}

function stringValuesOnly(
	values: Record<string, FieldValue>,
): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(values)) {
		if (typeof v === "string") out[k] = v;
	}
	return out;
}
