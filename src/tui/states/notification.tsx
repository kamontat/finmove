import {
	createContext,
	type JSX,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useSyncExternalStore,
} from "react";
import { buildBreadcrumb } from "../buildBreadcrumb";
import type { Notification, NotificationSeverity } from "../models";
import { useData } from "./data";
import { useNavigation } from "./navigation";
import { NotificationStore } from "./notificationStore";

interface NotificationContextValue {
	current: Notification | null;
	history: Notification[];
	notify: (
		text: string,
		severity: NotificationSeverity,
		opts?: { persistent?: boolean },
	) => void;
	dismiss: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(
	null,
);

interface NotificationProviderProps {
	children: ReactNode;
}

export function NotificationProvider({
	children,
}: NotificationProviderProps): JSX.Element {
	const { currentRoute } = useNavigation();
	const { trip } = useData();

	const storeRef = useRef<NotificationStore | null>(null);
	if (storeRef.current === null) {
		storeRef.current = new NotificationStore();
	}
	const store = storeRef.current;

	const routeRef = useRef(currentRoute);
	routeRef.current = currentRoute;
	const tripRef = useRef(trip);
	tripRef.current = trip;

	const subscribe = useCallback(
		(listener: () => void) => store.subscribe(listener),
		[store],
	);
	const current = useSyncExternalStore(
		subscribe,
		() => store.getCurrent(),
		() => store.getCurrent(),
	);
	const history = useSyncExternalStore(
		subscribe,
		() => store.getHistory(),
		() => store.getHistory(),
	);

	const notify = useCallback<NotificationContextValue["notify"]>(
		(text, severity, opts) => {
			const route = buildBreadcrumb(routeRef.current, tripRef.current);
			store.notify(text, severity, route, opts);
		},
		[store],
	);
	const dismiss = useCallback(() => {
		store.dismiss();
	}, [store]);

	const value = useMemo<NotificationContextValue>(
		() => ({ current, history, notify, dismiss }),
		[current, history, notify, dismiss],
	);

	return (
		<NotificationContext.Provider value={value}>
			{children}
		</NotificationContext.Provider>
	);
}

export function useNotification(): NotificationContextValue {
	const ctx = useContext(NotificationContext);
	if (ctx === null) {
		throw new Error(
			"useNotification must be used within a NotificationProvider",
		);
	}
	return ctx;
}
