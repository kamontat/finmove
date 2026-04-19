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
import type { HelpHint, SelectOption } from "../models";

interface LayoutContextValue {
	menuOptions: SelectOption[];
	onMenuSelect: ((value: string) => void) | null;
	hints: HelpHint[];
	borderColor: string | null;
	titleSuffix: string | null;
	setMenu: (options: SelectOption[], onSelect: (value: string) => void) => void;
	setHints: (hints: HelpHint[]) => void;
	setBorderColor: (color: string | null) => void;
	setTitleSuffix: (suffix: string | null) => void;
	resetLayout: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

interface LayoutProviderProps {
	children: ReactNode;
}

export function LayoutProvider({ children }: LayoutProviderProps): JSX.Element {
	const [menuOptions, setMenuOptions] = useState<SelectOption[]>([]);
	const [hints, setHintsState] = useState<HelpHint[]>([]);
	const [borderColor, setBorderColorState] = useState<string | null>(null);
	const [titleSuffix, setTitleSuffixState] = useState<string | null>(null);
	const [callbackTick, setCallbackTick] = useState(0);
	const onMenuSelectRef = useRef<((value: string) => void) | null>(null);

	const setMenu = useCallback(
		(options: SelectOption[], onSelect: (value: string) => void) => {
			setMenuOptions(options);
			onMenuSelectRef.current = onSelect;
			setCallbackTick((t) => t + 1);
		},
		[],
	);

	const setHints = useCallback((newHints: HelpHint[]) => {
		setHintsState(newHints);
	}, []);

	const setBorderColor = useCallback((color: string | null) => {
		setBorderColorState(color);
	}, []);

	const setTitleSuffix = useCallback((suffix: string | null) => {
		setTitleSuffixState(suffix);
	}, []);

	const resetLayout = useCallback(() => {
		setMenuOptions([]);
		setHintsState([]);
		setBorderColorState(null);
		setTitleSuffixState(null);
		onMenuSelectRef.current = null;
		setCallbackTick((t) => t + 1);
	}, []);

	const onMenuSelectSnapshot =
		callbackTick >= 0 ? onMenuSelectRef.current : null;

	const value = useMemo<LayoutContextValue>(
		() => ({
			menuOptions,
			onMenuSelect: onMenuSelectSnapshot,
			hints,
			borderColor,
			titleSuffix,
			setMenu,
			setHints,
			setBorderColor,
			setTitleSuffix,
			resetLayout,
		}),
		[
			menuOptions,
			onMenuSelectSnapshot,
			hints,
			borderColor,
			titleSuffix,
			setMenu,
			setHints,
			setBorderColor,
			setTitleSuffix,
			resetLayout,
		],
	);

	return (
		<LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
	);
}

export function useLayout(): LayoutContextValue {
	const ctx = useContext(LayoutContext);
	if (ctx === null) {
		throw new Error("useLayout must be used within a LayoutProvider");
	}
	return ctx;
}
