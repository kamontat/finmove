import { useApp } from "ink";
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
import type { RoutePath } from "../models";
import { routes } from "../router";
import { useData } from "./data";
import { useFocus } from "./focus";
import { useLayout } from "./layout";

interface RouteEntry {
	path: RoutePath;
	props: Record<string, unknown>;
}

interface NavigationContextValue {
	currentRoute: RouteEntry;
	goTo: (
		path: RoutePath,
		options?: { props?: Record<string, unknown>; replace?: boolean },
	) => void;
	goBack: () => void;
	goExit: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

interface NavigationProviderProps {
	initialPath: RoutePath;
	initialProps?: Record<string, unknown>;
	children: ReactNode;
}

export function NavigationProvider({
	initialPath,
	initialProps = {},
	children,
}: NavigationProviderProps): JSX.Element {
	const { exit } = useApp();
	const { setFocus, setMenuAvailable } = useFocus();
	const { resetLayout } = useLayout();
	const { loadTripByPath, clearTrip } = useData();

	const [currentRoute, setCurrentRoute] = useState<RouteEntry>({
		path: initialPath,
		props: initialProps,
	});
	const historyRef = useRef<RouteEntry[]>([]);

	const syncTripData = useCallback(
		(path: RoutePath, props: Record<string, unknown>) => {
			if (path === "/trips") {
				clearTrip();
			} else {
				const tripDirPath = props["tripDirPath"];
				if (typeof tripDirPath === "string") {
					loadTripByPath(tripDirPath);
				}
			}
		},
		[clearTrip, loadTripByPath],
	);

	const applyRoute = useCallback(
		(entry: RouteEntry) => {
			const config = routes[entry.path];
			resetLayout();
			setFocus(config.defaultFocus);
			setMenuAvailable(false);
			syncTripData(entry.path, entry.props);
			setCurrentRoute(entry);
		},
		[resetLayout, setFocus, setMenuAvailable, syncTripData],
	);

	const goTo = useCallback(
		(
			path: RoutePath,
			options?: { props?: Record<string, unknown>; replace?: boolean },
		) => {
			const props = options?.props ?? {};
			const replace = options?.replace ?? false;

			setCurrentRoute((prev) => {
				if (!replace) {
					historyRef.current.push(prev);
				}
				return prev; // actual update happens in applyRoute
			});

			applyRoute({ path, props });
		},
		[applyRoute],
	);

	const goBack = useCallback(() => {
		const prev = historyRef.current.pop();
		if (prev) {
			applyRoute(prev);
		} else {
			exit();
		}
	}, [applyRoute, exit]);

	const goExit = useCallback(() => {
		exit();
	}, [exit]);

	const value = useMemo<NavigationContextValue>(
		() => ({ currentRoute, goTo, goBack, goExit }),
		[currentRoute, goTo, goBack, goExit],
	);

	return (
		<NavigationContext.Provider value={value}>
			{children}
		</NavigationContext.Provider>
	);
}

export function useNavigation(): NavigationContextValue {
	const ctx = useContext(NavigationContext);
	if (ctx === null) {
		throw new Error("useNavigation must be used within a NavigationProvider");
	}
	return ctx;
}
