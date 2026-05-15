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
import type { RouteEntry, RouteParams, RoutePath, Routes } from "../models";
import { useData } from "./data";
import { useFocus } from "./focus";
import { useLayout } from "./layout";
import { useMenu } from "./menu";

type GoToOptions<P extends RoutePath> = {
	replace?: boolean;
} & (Record<string, never> extends RouteParams[P]
	? { props?: RouteParams[P] }
	: { props: RouteParams[P] });

interface NavigationContextValue {
	currentRoute: RouteEntry;
	goTo: <P extends RoutePath>(path: P, options?: GoToOptions<P>) => void;
	goBack: (steps?: number) => void;
	goExit: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

interface NavigationProviderProps {
	initial: RouteEntry;
	routes: Routes;
	children: ReactNode;
}

export function NavigationProvider({
	initial,
	routes,
	children,
}: NavigationProviderProps): JSX.Element {
	const { exit } = useApp();
	const { setFocus, setMenuAvailable } = useFocus();
	const { resetLayout } = useLayout();
	const { resetMenu } = useMenu();
	const { loadTripByPath, clearTrip } = useData();

	const [currentRoute, setCurrentRoute] = useState<RouteEntry>(initial);
	const historyRef = useRef<RouteEntry[]>([]);

	const syncTripData = useCallback(
		(entry: RouteEntry) => {
			if (entry.path === "/trips") {
				clearTrip();
				return;
			}
			if ("tripDirPath" in entry.props) {
				loadTripByPath(entry.props.tripDirPath);
			}
		},
		[clearTrip, loadTripByPath],
	);

	const applyRoute = useCallback(
		(entry: RouteEntry) => {
			resetLayout();
			resetMenu();
			setFocus(routes[entry.path].defaultFocus ?? "main");
			setMenuAvailable(false);
			syncTripData(entry);
			setCurrentRoute(entry);
		},
		[resetLayout, resetMenu, setFocus, setMenuAvailable, syncTripData, routes],
	);

	const goTo = useCallback(
		<P extends RoutePath>(path: P, options?: GoToOptions<P>) => {
			const props =
				(options as { props?: RouteParams[P] } | undefined)?.props ??
				({} as RouteParams[P]);
			const replace = options?.replace ?? false;

			setCurrentRoute((prev) => {
				if (!replace) {
					historyRef.current.push(prev);
				}
				return prev; // actual update happens in applyRoute
			});

			applyRoute({ path, props } as RouteEntry);
		},
		[applyRoute],
	);

	const goBack = useCallback(
		(steps: number = 1) => {
			if (steps <= 0) return;
			let target: RouteEntry | undefined;
			for (let i = 0; i < steps; i++) {
				const prev = historyRef.current.pop();
				if (!prev) {
					exit();
					return;
				}
				target = prev;
			}
			if (target) {
				applyRoute(target);
			}
		},
		[applyRoute, exit],
	);

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

export function useRouteProps<P extends RoutePath>(path: P): RouteParams[P];
export function useRouteProps<P extends RoutePath>(
	paths: readonly P[],
): RouteParams[P];
export function useRouteProps<P extends RoutePath>(
	pathOrPaths: P | readonly P[],
): RouteParams[P] {
	const { currentRoute } = useNavigation();
	const allowed: readonly RoutePath[] = Array.isArray(pathOrPaths)
		? pathOrPaths
		: [pathOrPaths as P];
	if (!allowed.includes(currentRoute.path)) {
		throw new Error(
			`useRouteProps(${JSON.stringify(pathOrPaths)}) called on route ${currentRoute.path}`,
		);
	}
	return currentRoute.props as RouteParams[P];
}
