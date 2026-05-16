import { Box, Text, useInput } from "ink";
import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import type { FieldValue, FormFieldConfig } from "../../models";
import { useFocus } from "../../states/focus";
import { useFormBuffer } from "../../states/formBuffer";
import { DateInput } from "../atoms/DateInput";
import { SelectInput } from "../atoms/SelectInput";
import { TextInput } from "../atoms/TextInput";

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
				if (field.type === "display") continue;
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

	const [cursor, setCursor] = useState(() => {
		const idx = fields.findIndex((f) => f.type !== "display");
		return idx === -1 ? fields.length : idx;
	});
	const [editing, setEditing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isFilled = useCallback(
		(field: FormFieldConfig): boolean => {
			if (field.type === "display") return true;
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
			if (field.type === "display") return true;
			if (!field.required) return true;
			return isFilled(field);
		});
		const hasAnyChange = fields.some((field) => {
			if (field.type === "display") return false;
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
			if (field.type === "display") continue;
			const v = values[field.key];
			if (field.type === "multiselect") {
				result[field.key] = Array.isArray(v) ? v : [];
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

	const isStop = useCallback(
		(index: number): boolean => {
			if (index === fields.length) return true; // submit row
			const field = fields[index];
			return !!field && field.type !== "display";
		},
		[fields],
	);

	const moveCursor = useCallback(
		(from: number, direction: 1 | -1): number => {
			let next = from;
			for (let i = 0; i < totalItems; i++) {
				next =
					direction === 1
						? next < totalItems - 1
							? next + 1
							: 0
						: next > 0
							? next - 1
							: totalItems - 1;
				if (isStop(next)) return next;
			}
			return from;
		},
		[isStop, totalItems],
	);

	useInput(
		(input, key) => {
			if (key.upArrow) {
				setCursor((c) => moveCursor(c, -1));
			} else if (key.downArrow) {
				setCursor((c) => moveCursor(c, 1));
			} else if (key.return) {
				if (cursor === fields.length) {
					handleSubmit();
				} else {
					const field = fields[cursor];
					if (!field || field.type === "display") return;
					if (field.type === "multiselect") {
						field.onEdit();
					} else if (field.type === "select") {
						if (field.onEdit) {
							field.onEdit();
						} else {
							enterEdit();
						}
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
				if (field.type === "display") {
					return (
						<Box key={field.key} flexDirection="column">
							<Text dimColor>
								{"  "}
								{field.label}: {field.value}
							</Text>
						</Box>
					);
				}

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
								{field.type === "select" && !field.onEdit && (
									<SelectInput
										options={field.options}
										isActive={true}
										initialIndex={Math.max(
											0,
											field.options.findIndex(
												(o) =>
													o.value ===
													(typeof currentValue === "string" &&
													currentValue !== ""
														? currentValue
														: field.defaultValue),
											),
										)}
										onChange={(val) => setStringValue(field.key, val)}
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
