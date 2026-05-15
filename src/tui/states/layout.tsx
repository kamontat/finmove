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
	titles: string[];
	title: string;
	setHints: (hints: HelpHint[]) => void;
	setColor: (colors: LayoutColors) => void;
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
	const [titles, setTitlesState] = useState<string[]>([]);

	const setHints = useCallback((newHints: HelpHint[]) => {
		setHintsState(newHints);
	}, []);

	const setColor = useCallback((next: LayoutColors) => {
		setColorsState(next);
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
		setTitlesState([]);
	}, []);

	const title = useMemo(() => titles.join(" > "), [titles]);

	const value = useMemo<LayoutContextValue>(
		() => ({
			hints,
			colors,
			titles,
			title,
			setHints,
			setColor,
			setTitle,
			clearTitle,
			resetLayout,
		}),
		[
			hints,
			colors,
			titles,
			title,
			setHints,
			setColor,
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
