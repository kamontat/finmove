import { Box, Text, useInput } from "ink";
import { type JSX, useCallback, useEffect, useMemo, useState } from "react";
import type {
	FieldValue,
	FormFieldConfig,
	FormFieldStrategy,
} from "../../models";
import { useFocus } from "../../states/focus";
import { useFormBuffer } from "../../states/formBuffer";
import { formFieldBooleanStrategy } from "../molecules/FormFieldBoolean";
import { formFieldDateStrategy } from "../molecules/FormFieldDate";
import { formFieldMultiselectStrategy } from "../molecules/FormFieldMultiselect";
import { formFieldNumberStrategy } from "../molecules/FormFieldNumber";
import { formFieldSelectStrategy } from "../molecules/FormFieldSelect";
import { formFieldTextStrategy } from "../molecules/FormFieldText";

interface FormProps {
	fields: FormFieldConfig[];
	onSubmit: (values: Record<string, FieldValue>) => void;
	submitLabel?: string;
	submitKey?: string;
	formId?: string;
}

const STRATEGIES = {
	text: formFieldTextStrategy,
	select: formFieldSelectStrategy,
	boolean: formFieldBooleanStrategy,
	date: formFieldDateStrategy,
	multiselect: formFieldMultiselectStrategy,
	number: formFieldNumberStrategy,
} as const;

function getStrategy(field: FormFieldConfig): FormFieldStrategy {
	return STRATEGIES[field.type] as FormFieldStrategy;
}

function isEditable(field: FormFieldConfig): boolean {
	return field.editable !== false;
}

// Use `in` rather than `??` so that an explicit `null` (the "cleared"
// sentinel) is preserved instead of being replaced by emptyValue.
function readValue(
	values: Record<string, FieldValue>,
	key: string,
	emptyValue: FieldValue,
): FieldValue {
	return key in values ? (values[key] as FieldValue) : emptyValue;
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
				if (!isEditable(field)) continue;
				initial[field.key] = getStrategy(field).emptyValue;
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
		const idx = fields.findIndex(isEditable);
		return idx === -1 ? fields.length : idx;
	});
	const [editing, setEditing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const canSubmit = useMemo(() => {
		const allRequiredFilled = fields.every((field) => {
			if (!isEditable(field)) return true;
			if (!field.required) return true;
			const strategy = getStrategy(field);
			return strategy.isFilled(
				field,
				readValue(values, field.key, strategy.emptyValue),
			);
		});
		const hasAnyUserValue = fields.some((field) => {
			if (!isEditable(field)) return false;
			const strategy = getStrategy(field);
			return strategy.hasUserValue(
				readValue(values, field.key, strategy.emptyValue),
			);
		});
		return allRequiredFilled && hasAnyUserValue;
	}, [fields, values]);

	const totalItems = canSubmit ? fields.length + 1 : fields.length;

	if (cursor >= totalItems) {
		setCursor(totalItems - 1);
	}

	const handleSubmit = useCallback(() => {
		if (!canSubmit) return;
		const result: Record<string, FieldValue> = {};
		for (const field of fields) {
			if (!isEditable(field)) continue;
			const strategy = getStrategy(field);
			result[field.key] = strategy.normalizeForSubmit(
				field,
				readValue(values, field.key, strategy.emptyValue),
			);
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

	const handleFieldSubmit = useCallback(
		(key: string, value: FieldValue) => {
			setValue(key, value);
			exitEdit();
		},
		[setValue, exitEdit],
	);

	const isStop = useCallback(
		(index: number): boolean => {
			if (index === fields.length) return true; // submit row
			const field = fields[index];
			return !!field && isEditable(field);
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
					if (!field || !isEditable(field)) return;
					const action = getStrategy(field).onEnterPress(field);
					if (action === "edit") {
						enterEdit();
					} else {
						action();
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
				const strategy = getStrategy(field);

				if (!isEditable(field)) {
					const display = strategy.getDisplay(
						field,
						field.defaultValue ?? strategy.emptyValue,
						values,
					);
					return (
						<Box key={field.key} flexDirection="column">
							<Text dimColor>
								{"  "}
								{field.label}: {display}
							</Text>
						</Box>
					);
				}

				const isCursor = cursor === index;
				const currentValue = readValue(values, field.key, strategy.emptyValue);
				const action = strategy.onEnterPress(field);
				const isEditingThisRow = editing && isCursor && action === "edit";

				const display = strategy.getDisplay(field, currentValue, values);
				const preview = strategy.getPreview(field, values);
				const optionalSuffix = !field.required ? " (optional)" : "";

				const labelTail =
					display !== ""
						? display
						: preview !== undefined
							? `(${preview})`
							: "";

				const labelText = (
					<>
						{field.label}
						{optionalSuffix}: {labelTail}
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

						{isEditingThisRow && (
							<Box marginLeft={4}>
								<strategy.Editor
									field={field}
									value={currentValue}
									allValues={values}
									onSubmit={(val) => handleFieldSubmit(field.key, val)}
									onCancel={exitEdit}
								/>
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
