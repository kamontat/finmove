import {
	createContext,
	type JSX,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";
import type { FocusZone } from "../models";
import { type ArmedState, type MenuOption, MenuStore } from "./menuStore";

interface MenuContextValue {
	options: MenuOption[];
	onSelect: ((value: string) => void) | null;
	armed: ArmedState | null;
	armedHint: string | null;
	activeIndex: number | null;
	setMenu: (options: MenuOption[], onSelect: (value: string) => void) => void;
	setActiveIndex: (index: number | null) => void;
	trigger: (value: string, focus: FocusZone) => void;
	reset: () => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

interface MenuProviderProps {
	children: ReactNode;
}

export function MenuProvider({ children }: MenuProviderProps): JSX.Element {
	const storeRef = useRef<MenuStore>(new MenuStore());
	const [, setTick] = useState(0);
	const bump = useCallback(() => setTick((t) => t + 1), []);

	const setMenu = useCallback(
		(options: MenuOption[], onSelect: (value: string) => void) => {
			storeRef.current.setMenu(options, onSelect);
			bump();
		},
		[bump],
	);

	const setActiveIndex = useCallback(
		(index: number | null) => {
			const before = storeRef.current.getActiveIndex();
			const beforeArmed = storeRef.current.getArmed();
			storeRef.current.setActiveIndex(index);
			if (before !== index || beforeArmed !== storeRef.current.getArmed()) {
				bump();
			}
		},
		[bump],
	);

	const trigger = useCallback(
		(value: string, focus: FocusZone) => {
			storeRef.current.trigger(value, focus);
			bump();
		},
		[bump],
	);

	const reset = useCallback(() => {
		storeRef.current.reset();
		bump();
	}, [bump]);

	const value = useMemo<MenuContextValue>(() => {
		const s = storeRef.current;
		return {
			options: s.getOptions(),
			onSelect: s.getOnSelect(),
			armed: s.getArmed(),
			armedHint: s.getArmedHint(),
			activeIndex: s.getActiveIndex(),
			setMenu,
			setActiveIndex,
			trigger,
			reset,
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: bumped via setTick
	}, [setMenu, setActiveIndex, trigger, reset]);

	return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu(): MenuContextValue {
	const ctx = useContext(MenuContext);
	if (ctx === null) {
		throw new Error("useMenu must be used within a MenuProvider");
	}
	return ctx;
}

export type { ArmedState, MenuOption };
