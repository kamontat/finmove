import {
	createContext,
	type JSX,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import type { Trip } from "../../core/models";
import { loadTrip } from "../../core/services/trip/loadTrip";

interface DataContextValue {
	trip: Trip | null;
	loading: boolean;
	currentTripPath: string | null;
	loadTripByPath: (tripDirPath: string) => void;
	reloadTrip: () => void;
	clearTrip: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

interface DataProviderProps {
	children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps): JSX.Element {
	const [trip, setTrip] = useState<Trip | null>(null);
	const [loading, setLoading] = useState(false);
	const [currentTripPath, setCurrentTripPath] = useState<string | null>(null);

	const loadTripByPath = useCallback((tripDirPath: string) => {
		setLoading(true);
		try {
			const loaded = loadTrip(tripDirPath);
			setTrip(loaded);
			setCurrentTripPath(tripDirPath);
		} finally {
			setLoading(false);
		}
	}, []);

	const reloadTrip = useCallback(() => {
		setCurrentTripPath((path) => {
			if (path === null) return path;
			setLoading(true);
			try {
				const loaded = loadTrip(path);
				setTrip(loaded);
			} finally {
				setLoading(false);
			}
			return path;
		});
	}, []);

	const clearTrip = useCallback(() => {
		setTrip(null);
		setCurrentTripPath(null);
	}, []);

	const value = useMemo<DataContextValue>(
		() => ({
			trip,
			loading,
			currentTripPath,
			loadTripByPath,
			reloadTrip,
			clearTrip,
		}),
		[trip, loading, currentTripPath, loadTripByPath, reloadTrip, clearTrip],
	);

	return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
	const ctx = useContext(DataContext);
	if (ctx === null) {
		throw new Error("useData must be used within a DataProvider");
	}
	return ctx;
}
