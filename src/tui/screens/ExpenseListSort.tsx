import { Box, Text, useInput } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { SortDir, SortKey } from "../../core/services/expense";
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

	useInput(
		(input, key) => {
			if (key.upArrow) {
				setSlotCursor((c) => (c > 0 ? c - 1 : SLOT_COUNT - 1));
			} else if (key.downArrow) {
				setSlotCursor((c) => (c < SLOT_COUNT - 1 ? c + 1 : 0));
			} else if (key.return) {
				openPicker(slotCursor);
			} else if (input === " ") {
				toggleSlotDir();
			}
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

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	const slotLabels = Array.from({ length: SLOT_COUNT }, (_, i) => {
		const slot = slots[i];
		return slot
			? `${i + 1}. ${COLUMN_LABEL[slot.key]}  ${dirArrow(slot.dir)}`
			: `${i + 1}. <not set>`;
	});
	const leftWidth = Math.max(...slotLabels.map((l) => l.length));

	const totalRows = picker
		? Math.max(SLOT_COUNT, picker.slotIndex + picker.options.length)
		: SLOT_COUNT;

	function renderLeftRow(i: number): JSX.Element {
		const isSlotRow = i < SLOT_COUNT;
		const slot = isSlotRow ? slots[i] : undefined;
		const showCursor = picker === null && i === slotCursor;
		const label = isSlotRow ? (slotLabels[i] ?? "") : "";
		const padded = label.padEnd(leftWidth);
		const dim = isSlotRow && slot === null;
		const showSeparator = picker !== null;
		const trailing = showSeparator ? " |" : "";
		return (
			<Text
				// biome-ignore lint/suspicious/noArrayIndexKey: index is stable here
				key={i}
				{...(dim ? { dimColor: true } : {})}
				inverse={showCursor}
			>
				{showCursor ? "> " : "  "}
				{padded}
				{trailing}
			</Text>
		);
	}

	function renderPickerColumn(): JSX.Element | null {
		if (!picker) return null;
		return (
			<Box flexDirection="column" marginLeft={1} marginTop={picker.slotIndex}>
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

	return (
		<Box flexDirection="row">
			<Box flexDirection="column">
				{Array.from({ length: totalRows }, (_, i) => renderLeftRow(i))}
			</Box>
			{renderPickerColumn()}
		</Box>
	);
}
