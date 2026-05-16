import { Box, Text, useInput } from "ink";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import type { SortDir, SortKey } from "../../core/services/expense";
import { VerticalSelect } from "../components/atoms/VerticalSelect";
import { SORT_HINTS, SORT_PICKER_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import {
	SLOT_COUNT,
	type Slot,
	useExpenseListSort,
} from "../states/expenseListSort";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation } from "../states/navigation";
import { tripTitle } from "../utils/titles";

const COLUMN_ORDER: SortKey[] = ["date", "thb", "account", "owner", "category"];

const COLUMN_LABEL: Record<SortKey, string> = {
	date: "Date",
	thb: "THB",
	account: "Account",
	owner: "Owner",
	category: "Category",
};

const DEFAULT_DIR: Record<SortKey, SortDir> = {
	date: "desc",
	thb: "desc",
	account: "asc",
	owner: "asc",
	category: "asc",
};

function dirArrow(dir: SortDir): string {
	return dir === "desc" ? "↓" : "↑";
}

type PickerOption =
	| { kind: "unset" }
	| { kind: "column"; key: SortKey; dir: SortDir };

interface PickerState {
	slotIndex: number;
	options: PickerOption[];
	cursor: number;
}

function buildPickerOptions(slots: Slot[], slotIndex: number): PickerOption[] {
	const current = slots[slotIndex] ?? null;
	const usedKeys = new Set<SortKey>();
	for (let i = 0; i < slots.length; i++) {
		if (i === slotIndex) continue;
		const s = slots[i];
		if (s) usedKeys.add(s.key);
	}
	const options: PickerOption[] = [{ kind: "unset" }];
	if (current) {
		options.push({ kind: "column", key: current.key, dir: current.dir });
	}
	for (const col of COLUMN_ORDER) {
		if (current && current.key === col) continue;
		if (usedKeys.has(col)) continue;
		options.push({ kind: "column", key: col, dir: DEFAULT_DIR[col] });
	}
	return options;
}

function initialPickerCursor(options: PickerOption[], current: Slot): number {
	if (current === null) return 0;
	const idx = options.findIndex(
		(o) => o.kind === "column" && o.key === current.key,
	);
	return idx === -1 ? 0 : idx;
}

export function ExpenseListSort(): JSX.Element {
	const { trip } = useData();
	const { slots, setSlots } = useExpenseListSort();
	const { focus, setFocus } = useFocus();
	const { setTitle, clearTitle, setHints, setColor } = useLayout();
	const { setMenu } = useMenu();
	const { goBack } = useNavigation();

	const initialSlotsRef = useRef<Slot[]>(slots);
	const [slotCursor, setSlotCursor] = useState(0);
	const [picker, setPicker] = useState<PickerState | null>(null);

	useEffect(() => {
		setTitle(tripTitle(trip, "Expenses", "Sort by"));
		return () => clearTitle();
	}, [setTitle, clearTitle, trip]);

	useEffect(() => {
		setColor({});
		setMenu([], () => {});
		setHints(picker ? SORT_PICKER_HINTS : SORT_HINTS);
	}, [setColor, setMenu, setHints, picker]);

	function openPicker(slotIndex: number) {
		const options = buildPickerOptions(slots, slotIndex);
		const cursor = initialPickerCursor(options, slots[slotIndex] ?? null);
		setPicker({ slotIndex, options, cursor });
		setFocus("input");
	}

	function closePicker() {
		setPicker(null);
		setFocus("main");
	}

	function commitPicker() {
		if (!picker) return;
		const choice = picker.options[picker.cursor];
		if (!choice) {
			closePicker();
			return;
		}
		const next: Slot[] = [...slots];
		next[picker.slotIndex] =
			choice.kind === "unset" ? null : { key: choice.key, dir: choice.dir };
		setSlots(next);
		closePicker();
	}

	function togglePickerDir() {
		if (!picker) return;
		const opt = picker.options[picker.cursor];
		if (!opt || opt.kind !== "column") return;
		const newOptions = [...picker.options];
		newOptions[picker.cursor] = {
			kind: "column",
			key: opt.key,
			dir: opt.dir === "asc" ? "desc" : "asc",
		};
		setPicker({ ...picker, options: newOptions });
	}

	function toggleSlotDir() {
		const slot = slots[slotCursor];
		if (!slot) return;
		const next: Slot[] = [...slots];
		next[slotCursor] = {
			key: slot.key,
			dir: slot.dir === "asc" ? "desc" : "asc",
		};
		setSlots(next);
	}

	function cancelAll() {
		setSlots(initialSlotsRef.current);
		goBack();
	}

	function applyAll() {
		goBack();
	}

	useInput(
		(input) => {
			if (input === " ") toggleSlotDir();
			else if (input === "s") applyAll();
		},
		{ isActive: focus === "main" && picker === null },
	);

	useInput(
		(input, key) => {
			if (!picker) return;
			if (input === " ") {
				togglePickerDir();
			} else if (key.upArrow) {
				setPicker({
					...picker,
					cursor:
						picker.cursor > 0 ? picker.cursor - 1 : picker.options.length - 1,
				});
			} else if (key.downArrow) {
				setPicker({
					...picker,
					cursor:
						picker.cursor < picker.options.length - 1 ? picker.cursor + 1 : 0,
				});
			} else if (key.return) {
				commitPicker();
			} else if (key.escape || input === "q") {
				closePicker();
			}
		},
		{ isActive: focus === "input" && picker !== null },
	);

	function renderSlotRow(i: number, selected: boolean): JSX.Element {
		const slot = slots[i];
		const label = slot
			? `${i + 1}. ${COLUMN_LABEL[slot.key]}  ${dirArrow(slot.dir)}`
			: `${i + 1}. <not set>`;
		return (
			<Text inverse={selected} {...(slot === null ? { dimColor: true } : {})}>
				{selected ? "> " : "  "}
				{label}
			</Text>
		);
	}

	function renderPicker(): JSX.Element {
		if (!picker) return <Text />;
		return (
			<Box flexDirection="column" marginLeft={4}>
				{picker.options.map((opt, idx) => {
					const selected = idx === picker.cursor;
					const text =
						opt.kind === "unset"
							? "<not set>"
							: `${COLUMN_LABEL[opt.key]}  ${dirArrow(opt.dir)}`;
					return (
						<Text
							// biome-ignore lint/suspicious/noArrayIndexKey: index is stable here
							key={idx}
							inverse={selected}
							{...(opt.kind === "unset" ? { dimColor: true } : {})}
						>
							{selected ? "> " : "  "}
							{text}
						</Text>
					);
				})}
			</Box>
		);
	}

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	return (
		<Box flexDirection="column">
			<VerticalSelect
				rowCount={SLOT_COUNT}
				renderRow={renderSlotRow}
				onChange={(i) => openPicker(i)}
				onHighlight={setSlotCursor}
				onCancel={cancelAll}
				isActive={focus === "main" && picker === null}
			/>
			{picker && renderPicker()}
		</Box>
	);
}
