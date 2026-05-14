import {
	createContext,
	type JSX,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import type { HelpHint } from "../models";

export interface LayoutColors {
	border?: string;
	title?: string;
}

interface LayoutContextValue {
	hints: HelpHint[];
	colors: LayoutColors;
	titleSuffix: string | null;
	setHints: (hints: HelpHint[]) => void;
	setColor: (colors: LayoutColors) => void;
	setTitleSuffix: (suffix: string | null) => void;
	resetLayout: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

interface LayoutProviderProps {
	children: ReactNode;
}

export function LayoutProvider({ children }: LayoutProviderProps): JSX.Element {
	const [hints, setHintsState] = useState<HelpHint[]>([]);
	const [colors, setColorsState] = useState<LayoutColors>({});
	const [titleSuffix, setTitleSuffixState] = useState<string | null>(null);

	const setHints = useCallback((newHints: HelpHint[]) => {
		setHintsState(newHints);
	}, []);

	const setColor = useCallback((next: LayoutColors) => {
		setColorsState(next);
	}, []);

	const setTitleSuffix = useCallback((suffix: string | null) => {
		setTitleSuffixState(suffix);
	}, []);

	const resetLayout = useCallback(() => {
		setHintsState([]);
		setColorsState({});
		setTitleSuffixState(null);
	}, []);

	const value = useMemo<LayoutContextValue>(
		() => ({
			hints,
			colors,
			titleSuffix,
			setHints,
			setColor,
			setTitleSuffix,
			resetLayout,
		}),
		[
			hints,
			colors,
			titleSuffix,
			setHints,
			setColor,
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
