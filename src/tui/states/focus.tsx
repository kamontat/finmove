import {
	createContext,
	type JSX,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import type { FocusZone } from "../models";

interface FocusContextValue {
	focus: FocusZone;
	menuAvailable: boolean;
	setFocus: (zone: FocusZone) => void;
	toggleFocus: () => void;
	setMenuAvailable: (available: boolean) => void;
}

const FocusContext = createContext<FocusContextValue | null>(null);

interface FocusProviderProps {
	children: ReactNode;
}

export function FocusProvider({ children }: FocusProviderProps): JSX.Element {
	const [focus, setFocusState] = useState<FocusZone>("main");
	const [menuAvailable, setMenuAvailableState] = useState(false);

	const setFocus = useCallback((zone: FocusZone) => {
		setFocusState(zone);
	}, []);

	const toggleFocus = useCallback(() => {
		setFocusState((current) => {
			if (current === "input") return current;
			return current === "main" ? "menu" : "main";
		});
	}, []);

	const setMenuAvailable = useCallback((available: boolean) => {
		setMenuAvailableState(available);
	}, []);

	const value = useMemo<FocusContextValue>(
		() => ({
			focus,
			menuAvailable,
			setFocus,
			toggleFocus: menuAvailable ? toggleFocus : () => {},
			setMenuAvailable,
		}),
		[focus, menuAvailable, setFocus, toggleFocus, setMenuAvailable],
	);

	return (
		<FocusContext.Provider value={value}>{children}</FocusContext.Provider>
	);
}

export function useFocus(): FocusContextValue {
	const ctx = useContext(FocusContext);
	if (ctx === null) {
		throw new Error("useFocus must be used within a FocusProvider");
	}
	return ctx;
}
