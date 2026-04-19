import { join } from "node:path";
import { Box, useApp, useInput } from "ink";
import type { JSX } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Trip } from "../core/models";
import type { AppArgs } from "../core/parse-args";
import { createTrip } from "../core/services/trip/create-trip";
import { loadTrip } from "../core/services/trip/load-trip";
import { toDirName } from "../core/services/trip/to-dir-name";
import type { HelpHint } from "./components/molecules/help-bar";
import { HelpBar } from "./components/molecules/help-bar";
import { AccountList } from "./screens/account-list";
import { ExpenseForm } from "./screens/expense-form";
import { ExpenseList } from "./screens/expense-list";
import { ExportScreen } from "./screens/export";
import { OwnerList } from "./screens/owner-list";
import { TripList } from "./screens/trip-list";
import { TripMenu } from "./screens/trip-menu";

type Screen =
	| { type: "trip-list" }
	| { type: "trip-menu"; trip: Trip }
	| { type: "owners"; trip: Trip }
	| { type: "accounts"; trip: Trip }
	| { type: "expenses"; trip: Trip }
	| { type: "expense-form"; trip: Trip; expenseId?: string }
	| { type: "export"; trip: Trip };

function getInitialScreen(args: AppArgs): Screen {
	if (args.trip) {
		const tripPath = join(args.dataDir, args.trip);
		try {
			const trip = loadTrip(tripPath);
			if (args.page) {
				const pageMap: Record<string, Screen["type"]> = {
					owners: "owners",
					accounts: "accounts",
					expenses: "expenses",
					export: "export",
				};
				const screenType = pageMap[args.page];
				if (screenType) {
					return { type: screenType, trip } as Screen;
				}
			}
			return { type: "trip-menu", trip };
		} catch {
			return { type: "trip-list" };
		}
	}
	return { type: "trip-list" };
}

interface AppProps {
	args: AppArgs;
}

export function App({ args }: AppProps): JSX.Element {
	const [screen, setScreen] = useState<Screen>(() => getInitialScreen(args));
	const historyRef = useRef<Screen[]>([]);
	const { exit } = useApp();

	const navigateTo = useCallback((next: Screen) => {
		setScreen((current) => {
			historyRef.current.push(current);
			return next;
		});
	}, []);

	const goBack = useCallback(() => {
		const prev = historyRef.current.pop();
		if (prev) {
			if (prev.type !== "trip-list" && "trip" in prev) {
				try {
					const refreshed = loadTrip(prev.trip.dirPath);
					setScreen({ ...prev, trip: refreshed } as Screen);
				} catch {
					setScreen(prev);
				}
			} else {
				setScreen(prev);
			}
		} else {
			exit();
		}
	}, [exit]);

	useInput((input, key) => {
		if (key.escape) {
			exit();
			return;
		}
		if (input === "q") {
			goBack();
		}
	});

	const reloadTrip = useCallback((trip: Trip) => loadTrip(trip.dirPath), []);

	const hasHistory = historyRef.current.length > 0;

	const hints = useMemo((): HelpHint[] => {
		const h: HelpHint[] = [];

		switch (screen.type) {
			case "trip-list":
				h.push({ key: "1-9", label: "Select trip" });
				h.push({ key: "c", label: "Create trip" });
				break;
			case "trip-menu":
				h.push({ key: "o", label: "Owners" });
				h.push({ key: "a", label: "Accounts" });
				h.push({ key: "e", label: "Expenses" });
				h.push({ key: "x", label: "Export" });
				break;
			case "owners":
				h.push({ key: "a", label: "Add" });
				h.push({ key: "1-9", label: "Remove" });
				break;
			case "accounts":
				h.push({ key: "a", label: "Add" });
				h.push({ key: "1-9", label: "Remove" });
				break;
			case "expenses":
				h.push({ key: "a", label: "Add" });
				h.push({ key: "1-9", label: "Edit" });
				break;
			case "expense-form":
				h.push({ key: "Enter", label: "Confirm" });
				break;
			case "export":
				h.push({ key: "Enter", label: "Confirm" });
				break;
		}

		if (hasHistory) {
			h.push({ key: "q", label: "Back" });
		} else {
			h.push({ key: "q", label: "Quit" });
		}
		h.push({ key: "esc", label: "Quit" });
		h.push({ key: "?", label: "Toggle help" });

		return h;
	}, [screen.type, hasHistory]);

	const defaultSettings = {
		name: "",
		startDate: "",
		endDate: "",
		countries: [] as string[],
		baseCurrency: "THB" as const,
		currencies: {},
		categories: [
			"Flight",
			"Hotels",
			"Transportation",
			"Shopping",
			"Eating",
			"Activities",
		],
		tags: [] as string[],
		exportPath: "./expenses.csv",
	};

	function renderScreen(): JSX.Element {
		switch (screen.type) {
			case "trip-list":
				return (
					<TripList
						dataDir={args.dataDir}
						onSelectTrip={(trip) => navigateTo({ type: "trip-menu", trip })}
						onCreateTrip={(name, startDate, endDate) => {
							const dirName = toDirName(name, startDate);
							const trip = createTrip(args.dataDir, dirName, {
								...defaultSettings,
								name,
								startDate,
								endDate,
							});
							navigateTo({ type: "trip-menu", trip });
						}}
					/>
				);

			case "trip-menu":
				return (
					<TripMenu
						trip={screen.trip}
						onNavigate={(page) =>
							navigateTo({ type: page, trip: screen.trip } as Screen)
						}
					/>
				);

			case "owners":
				return (
					<OwnerList
						trip={screen.trip}
						onTripUpdated={() => {
							const updated = reloadTrip(screen.trip);
							setScreen({ type: "owners", trip: updated });
						}}
					/>
				);

			case "accounts":
				return (
					<AccountList
						trip={screen.trip}
						onTripUpdated={() => {
							const updated = reloadTrip(screen.trip);
							setScreen({ type: "accounts", trip: updated });
						}}
					/>
				);

			case "expenses":
				return (
					<ExpenseList
						trip={screen.trip}
						onAddExpense={() =>
							navigateTo({ type: "expense-form", trip: screen.trip })
						}
						onEditExpense={(id) =>
							navigateTo({
								type: "expense-form",
								trip: screen.trip,
								expenseId: id,
							})
						}
					/>
				);

			case "expense-form": {
				const existing = screen.expenseId
					? screen.trip.expenses.find((e) => e.id === screen.expenseId)
					: undefined;
				return (
					<ExpenseForm
						trip={screen.trip}
						{...(existing !== undefined ? { existingExpense: existing } : {})}
						onDone={() => {
							const updated = reloadTrip(screen.trip);
							setScreen({ type: "expenses", trip: updated });
						}}
					/>
				);
			}

			case "export":
				return <ExportScreen trip={screen.trip} onBack={goBack} />;
		}
	}

	return (
		<Box flexDirection="column" gap={1}>
			{renderScreen()}
			<HelpBar hints={hints} />
		</Box>
	);
}
