import {
	createContext,
	type JSX,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

interface HelpContextValue {
	visible: boolean;
	toggleHelp: () => void;
}

const HelpContext = createContext<HelpContextValue | null>(null);

interface HelpProviderProps {
	children: ReactNode;
}

export function HelpProvider({ children }: HelpProviderProps): JSX.Element {
	const [visible, setVisible] = useState(false);

	const toggleHelp = useCallback(() => {
		setVisible((v) => !v);
	}, []);

	const value = useMemo<HelpContextValue>(
		() => ({ visible, toggleHelp }),
		[visible, toggleHelp],
	);

	return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelp(): HelpContextValue {
	const ctx = useContext(HelpContext);
	if (ctx === null) {
		throw new Error("useHelp must be used within a HelpProvider");
	}
	return ctx;
}
