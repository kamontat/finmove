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

interface MenuSnapshot {
	options: MenuOption[];
	onSelect: ((value: string) => void) | null;
	armed: ArmedState | null;
	armedHint: string | null;
}

interface MenuContextValue extends MenuSnapshot {
	setMenu: (options: MenuOption[], onSelect: (value: string) => void) => void;
	setActiveIndex: (index: number | null) => void;
	trigger: (value: string, focus: FocusZone) => void;
	resetMenu: () => void;
	reset: () => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

interface MenuProviderProps {
	children: ReactNode;
}

function snapshotOf(store: MenuStore): MenuSnapshot {
	return {
		options: store.getOptions(),
		onSelect: store.getOnSelect(),
		armed: store.getArmed(),
		armedHint: store.getArmedHint(),
	};
}

export function MenuProvider({ children }: MenuProviderProps): JSX.Element {
	const storeRef = useRef<MenuStore>(new MenuStore());
	const [snapshot, setSnapshot] = useState<MenuSnapshot>(() =>
		snapshotOf(storeRef.current),
	);
	const refresh = useCallback(() => {
		setSnapshot(snapshotOf(storeRef.current));
	}, []);

	const setMenu = useCallback(
		(options: MenuOption[], onSelect: (value: string) => void) => {
			storeRef.current.setMenu(options, onSelect);
			refresh();
		},
		[refresh],
	);

	const setActiveIndex = useCallback(
		(index: number | null) => {
			storeRef.current.setActiveIndex(index);
			refresh();
		},
		[refresh],
	);

	const trigger = useCallback(
		(value: string, focus: FocusZone) => {
			storeRef.current.trigger(value, focus);
			refresh();
		},
		[refresh],
	);

	const reset = useCallback(() => {
		storeRef.current.reset();
		refresh();
	}, [refresh]);

	const resetMenu = useCallback(() => {
		storeRef.current.setMenu([], () => {});
		storeRef.current.setActiveIndex(null);
		refresh();
	}, [refresh]);

	const value = useMemo<MenuContextValue>(
		() => ({
			...snapshot,
			setMenu,
			setActiveIndex,
			trigger,
			resetMenu,
			reset,
		}),
		[snapshot, setMenu, setActiveIndex, trigger, resetMenu, reset],
	);

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
