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
import type { RouteParams, RoutePath } from "../models";
import { routes } from "../router";
import { useData } from "./data";
import { useFocus } from "./focus";
import { useLayout } from "./layout";

type GoToOptions<P extends RoutePath> = {
	replace?: boolean;
} & (Record<string, never> extends RouteParams[P]
	? { props?: RouteParams[P] }
	: { props: RouteParams[P] });

interface NavigationContextValue {
	currentRoute: { path: RoutePath; props: Record<string, unknown> };
	goTo: <P extends RoutePath>(path: P, options?: GoToOptions<P>) => void;
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

	const [currentRoute, setCurrentRoute] = useState<{
		path: RoutePath;
		props: Record<string, unknown>;
	}>({ path: initialPath, props: initialProps });
	const historyRef = useRef<
		{ path: RoutePath; props: Record<string, unknown> }[]
	>([]);

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
		(entry: { path: RoutePath; props: Record<string, unknown> }) => {
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
		<P extends RoutePath>(path: P, options?: GoToOptions<P>) => {
			const props =
				(options as { props?: Record<string, unknown> } | undefined)?.props ??
				{};
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

export function useRouteProps<P extends RoutePath>(path: P): RouteParams[P] {
	const { currentRoute } = useNavigation();
	if (currentRoute.path !== path) {
		throw new Error(
			`useRouteProps("${path}") called on route ${currentRoute.path}`,
		);
	}
	return currentRoute.props as RouteParams[P];
}
