import { join } from "node:path";
import type { JSX } from "react";
import { useCallback, useState } from "react";
import type { Trip } from "../core/models";
import type { AppArgs } from "../core/parse-args";
import { createTrip } from "../core/services/trip/create-trip";
import { loadTrip } from "../core/services/trip/load-trip";
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

	const reloadTrip = useCallback((trip: Trip) => loadTrip(trip.dirPath), []);

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

	switch (screen.type) {
		case "trip-list":
			return (
				<TripList
					dataDir={args.dataDir}
					onSelectTrip={(trip) => setScreen({ type: "trip-menu", trip })}
					onCreateTrip={(dirName) => {
						const trip = createTrip(args.dataDir, dirName, {
							...defaultSettings,
							name: dirName,
						});
						setScreen({ type: "trip-menu", trip });
					}}
				/>
			);

		case "trip-menu":
			return (
				<TripMenu
					trip={screen.trip}
					onNavigate={(page) =>
						setScreen({ type: page, trip: screen.trip } as Screen)
					}
					onBack={() => setScreen({ type: "trip-list" })}
				/>
			);

		case "owners":
			return (
				<OwnerList
					trip={screen.trip}
					onBack={() => setScreen({ type: "trip-menu", trip: screen.trip })}
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
					onBack={() => setScreen({ type: "trip-menu", trip: screen.trip })}
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
					onBack={() => setScreen({ type: "trip-menu", trip: screen.trip })}
					onTripUpdated={() => {
						const updated = reloadTrip(screen.trip);
						setScreen({ type: "expenses", trip: updated });
					}}
					onAddExpense={() =>
						setScreen({ type: "expense-form", trip: screen.trip })
					}
					onEditExpense={(id) =>
						setScreen({
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
			return (
				<ExportScreen
					trip={screen.trip}
					onBack={() => setScreen({ type: "trip-menu", trip: screen.trip })}
				/>
			);
	}
}
