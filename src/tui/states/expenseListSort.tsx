import {
	createContext,
	type JSX,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import type { SortDir, SortKey, SortLevel } from "../../core/services/expense";

export type Slot = { key: SortKey; dir: SortDir } | null;

export const SLOT_COUNT = 5;

export const DEFAULT_SLOTS: Slot[] = [
	{ key: "date", dir: "desc" },
	null,
	null,
	null,
	null,
];

export function activeSlots(slots: Slot[]): SortLevel[] {
	return slots.filter((s): s is SortLevel => s !== null);
}

interface ExpenseListSortContextValue {
	slots: Slot[];
	setSlots: (next: Slot[]) => void;
}

const ExpenseListSortContext =
	createContext<ExpenseListSortContextValue | null>(null);

interface ExpenseListSortProviderProps {
	children: ReactNode;
}

export function ExpenseListSortProvider({
	children,
}: ExpenseListSortProviderProps): JSX.Element {
	const [slots, setSlotsState] = useState<Slot[]>(DEFAULT_SLOTS);

	const setSlots = useCallback((next: Slot[]) => {
		setSlotsState(next);
	}, []);

	const value = useMemo<ExpenseListSortContextValue>(
		() => ({ slots, setSlots }),
		[slots, setSlots],
	);

	return (
		<ExpenseListSortContext.Provider value={value}>
			{children}
		</ExpenseListSortContext.Provider>
	);
}

export function useExpenseListSort(): ExpenseListSortContextValue {
	const ctx = useContext(ExpenseListSortContext);
	if (ctx === null) {
		throw new Error(
			"useExpenseListSort must be used within an ExpenseListSortProvider",
		);
	}
	return ctx;
}
