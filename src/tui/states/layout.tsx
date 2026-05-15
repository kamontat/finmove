import {
	createContext,
	type JSX,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import type { HelpHint, TitleSegment } from "../models";

export interface LayoutColors {
	border?: string;
	title?: string;
}

interface LayoutContextValue {
	hints: HelpHint[];
	colors: LayoutColors;
	titleSuffix: string | null;
	titles: string[];
	title: string;
	setHints: (hints: HelpHint[]) => void;
	setColor: (colors: LayoutColors) => void;
	setTitleSuffix: (suffix: string | null) => void;
	setTitle: (segments: TitleSegment[]) => void;
	clearTitle: () => void;
	resetLayout: () => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

interface LayoutProviderProps {
	children: ReactNode;
}

function filterSegments(segments: TitleSegment[]): string[] {
	const result: string[] = [];
	for (const segment of segments) {
		if (typeof segment === "string" && segment !== "") {
			result.push(segment);
		}
	}
	return result;
}

export function LayoutProvider({ children }: LayoutProviderProps): JSX.Element {
	const [hints, setHintsState] = useState<HelpHint[]>([]);
	const [colors, setColorsState] = useState<LayoutColors>({});
	const [titleSuffix, setTitleSuffixState] = useState<string | null>(null);
	const [titles, setTitlesState] = useState<string[]>([]);

	const setHints = useCallback((newHints: HelpHint[]) => {
		setHintsState(newHints);
	}, []);

	const setColor = useCallback((next: LayoutColors) => {
		setColorsState(next);
	}, []);

	const setTitleSuffix = useCallback((suffix: string | null) => {
		setTitleSuffixState(suffix);
	}, []);

	const setTitle = useCallback((segments: TitleSegment[]) => {
		setTitlesState(filterSegments(segments));
	}, []);

	const clearTitle = useCallback(() => {
		setTitlesState([]);
	}, []);

	const resetLayout = useCallback(() => {
		setHintsState([]);
		setColorsState({});
		setTitleSuffixState(null);
		setTitlesState([]);
	}, []);

	const title = useMemo(() => titles.join(" > "), [titles]);

	const value = useMemo<LayoutContextValue>(
		() => ({
			hints,
			colors,
			titleSuffix,
			titles,
			title,
			setHints,
			setColor,
			setTitleSuffix,
			setTitle,
			clearTitle,
			resetLayout,
		}),
		[
			hints,
			colors,
			titleSuffix,
			titles,
			title,
			setHints,
			setColor,
			setTitleSuffix,
			setTitle,
			clearTitle,
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
