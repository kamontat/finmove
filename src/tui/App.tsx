import { join } from "node:path";
import { useApp, useInput } from "ink";
import type { JSX } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Trip } from "../core/models";
import type { AppArgs } from "../core/parseArgs";
import { createTrip } from "../core/services/trip/createTrip";
import { deleteTrip } from "../core/services/trip/deleteTrip";
import { duplicateTrip } from "../core/services/trip/duplicateTrip";
import { listTrips } from "../core/services/trip/listTrips";
import { loadTrip } from "../core/services/trip/loadTrip";
import { toDirName } from "../core/services/trip/toDirName";
import type { SelectOption } from "./components/atoms/SelectInput";
import type { HelpHint } from "./components/molecules/HelpBar";
import { Page } from "./components/organisms/Page";
import { AccountList } from "./screens/AccountList";
import { ExpenseForm } from "./screens/ExpenseForm";
import { ExpenseList } from "./screens/ExpenseList";
import { ExportScreen } from "./screens/Export";
import { OwnerList } from "./screens/OwnerList";
import { TripList } from "./screens/TripList";
import { TripMenu } from "./screens/TripMenu";

type Screen =
	| { type: "trip-list" }
	| { type: "trip-menu"; trip: Trip }
	| { type: "owners"; trip: Trip }
	| { type: "accounts"; trip: Trip }
	| { type: "expenses"; trip: Trip }
	| { type: "expense-form"; trip: Trip; expenseId?: string }
	| { type: "export"; trip: Trip };

type Focus = "main" | "menu";

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

const SCREEN_TITLES: Record<Screen["type"], string> = {
	"trip-list": "Trips",
	"trip-menu": "Trip Menu",
	owners: "Owners",
	accounts: "Accounts",
	expenses: "Expenses",
	"expense-form": "Expense",
	export: "Export CSV",
};

interface AppProps {
	args: AppArgs;
}

function defaultFocus(screenType: Screen["type"]): Focus {
	if (screenType === "trip-list") return "main";
	return "menu";
}

export function App({ args }: AppProps): JSX.Element {
	const [screen, setScreen] = useState<Screen>(() => getInitialScreen(args));
	const [focus, setFocus] = useState<Focus>(() =>
		defaultFocus(getInitialScreen(args).type),
	);
	const [pendingAction, setPendingAction] = useState<string | null>(null);
	const historyRef = useRef<Screen[]>([]);
	const { exit } = useApp();

	const navigateTo = useCallback((next: Screen) => {
		setScreen((current) => {
			historyRef.current.push(current);
			return next;
		});
		setFocus(defaultFocus(next.type));
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
			setFocus(defaultFocus(prev.type));
		} else {
			exit();
		}
	}, [exit]);

	const hasMenu =
		screen.type !== "expense-form" &&
		screen.type !== "export" &&
		!(screen.type === "trip-list" && pendingAction);

	const isInputScreen =
		screen.type === "expense-form" ||
		screen.type === "export" ||
		pendingAction !== null;

	useInput((input, key) => {
		if (key.escape) {
			if (isInputScreen) {
				// Let screen handle esc internally
				return;
			}
			if (historyRef.current.length > 0) {
				goBack();
			} else {
				exit();
			}
			return;
		}
		if (input === "q" && !isInputScreen) {
			if (historyRef.current.length > 0) {
				goBack();
			} else {
				exit();
			}
			return;
		}
		if (key.tab && hasMenu) {
			setFocus((f) => (f === "main" ? "menu" : "main"));
		}
	});

	const reloadTrip = useCallback((trip: Trip) => loadTrip(trip.dirPath), []);

	const hasHistory = historyRef.current.length > 0;

	const hints = useMemo((): HelpHint[] => {
		const h: HelpHint[] = [];
		h.push({ key: "tab", label: "Switch focus" });
		h.push({ key: "←→", label: "Navigate menu" });
		h.push({ key: "Enter", label: "Confirm" });
		if (hasHistory) {
			h.push({ key: "q", label: "Back (menu)" });
		} else {
			h.push({ key: "q", label: "Quit (menu)" });
		}
		h.push({ key: "esc", label: "Back (input) / Quit (menu)" });
		h.push({ key: "?", label: "Toggle help" });
		return h;
	}, [hasHistory]);

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

	const title = (() => {
		if (screen.type === "trip-menu" && "trip" in screen) {
			return screen.trip.settings.name;
		}
		if (screen.type === "trip-list" && pendingAction) {
			const actionTitles: Record<string, string> = {
				create: "Create Trip",
				duplicate: "Duplicate Trip",
				delete: "Delete Trip",
			};
			return actionTitles[pendingAction] ?? SCREEN_TITLES[screen.type];
		}
		return SCREEN_TITLES[screen.type];
	})();

	function getScreenConfig(): {
		content: JSX.Element;
		menuOptions: SelectOption[];
		onMenuSelect: (value: string) => void;
	} {
		switch (screen.type) {
			case "trip-list":
				return {
					content: (
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
							onDuplicateTrip={(sourcePath, newName) => {
								const dirName = toDirName(newName, "2026-01-01");
								duplicateTrip(args.dataDir, sourcePath, dirName, newName);
								setPendingAction(null);
								setScreen({ type: "trip-list" });
							}}
							onDeleteTrip={(tripPath) => {
								deleteTrip(tripPath);
								setPendingAction(null);
								setScreen({ type: "trip-list" });
							}}
							pendingAction={pendingAction}
							onActionConsumed={() => {
								setFocus("main");
							}}
							onCancelAction={() => {
								setPendingAction(null);
								setFocus("menu");
							}}
							focus={focus}
						/>
					),
					menuOptions: pendingAction
						? []
						: [
								{ label: "Create", value: "create", key: "c" },
								...(listTrips(args.dataDir).length > 0
									? [
											{ label: "Duplicate", value: "duplicate", key: "d" },
											{ label: "Delete", value: "delete", key: "x" },
										]
									: []),
							],
					onMenuSelect: (v) => setPendingAction(v),
				};

			case "trip-menu":
				return {
					content: <TripMenu trip={screen.trip} />,
					menuOptions: [
						{ label: "Owners", value: "owners", key: "o" },
						{ label: "Accounts", value: "accounts", key: "a" },
						{ label: "Expenses", value: "expenses", key: "e" },
						{ label: "Export CSV", value: "export", key: "x" },
					],
					onMenuSelect: (value) => {
						navigateTo({
							type: value,
							trip: screen.trip,
						} as Screen);
					},
				};

			case "owners":
				return {
					content: (
						<OwnerList
							trip={screen.trip}
							onTripUpdated={() => {
								const updated = reloadTrip(screen.trip);
								setScreen({ type: "owners", trip: updated });
							}}
							pendingAction={pendingAction}
							onActionConsumed={() => {
								setPendingAction(null);
								setFocus("main");
							}}
						/>
					),
					menuOptions: [
						{ label: "Add", value: "add", key: "a" },
						...screen.trip.owners.map((o, i) => ({
							label: `Remove ${o.name}`,
							value: `remove:${o.id}`,
							key: String(i + 1),
						})),
					],
					onMenuSelect: (v) => setPendingAction(v),
				};

			case "accounts":
				return {
					content: (
						<AccountList
							trip={screen.trip}
							onTripUpdated={() => {
								const updated = reloadTrip(screen.trip);
								setScreen({ type: "accounts", trip: updated });
							}}
							pendingAction={pendingAction}
							onActionConsumed={() => {
								setPendingAction(null);
								setFocus("main");
							}}
						/>
					),
					menuOptions: [
						{ label: "Add", value: "add", key: "a" },
						...screen.trip.accounts.map((a, i) => ({
							label: `Remove ${a.name}`,
							value: `remove:${a.id}`,
							key: String(i + 1),
						})),
					],
					onMenuSelect: (v) => setPendingAction(v),
				};

			case "expenses":
				return {
					content: <ExpenseList trip={screen.trip} />,
					menuOptions: [
						{ label: "Add", value: "add", key: "a" },
						...screen.trip.expenses.map((e, i) => ({
							label: e.payee,
							value: `edit:${e.id}`,
							key: String(i + 1),
						})),
					],
					onMenuSelect: (value) => {
						if (value === "add") {
							navigateTo({
								type: "expense-form",
								trip: screen.trip,
							});
						} else if (value.startsWith("edit:")) {
							navigateTo({
								type: "expense-form",
								trip: screen.trip,
								expenseId: value.replace("edit:", ""),
							});
						}
					},
				};

			case "expense-form": {
				const existing = screen.expenseId
					? screen.trip.expenses.find((e) => e.id === screen.expenseId)
					: undefined;
				return {
					content: (
						<ExpenseForm
							trip={screen.trip}
							{...(existing !== undefined ? { existingExpense: existing } : {})}
							onDone={() => {
								const updated = reloadTrip(screen.trip);
								setScreen({ type: "expenses", trip: updated });
							}}
						/>
					),
					menuOptions: [],
					onMenuSelect: () => {},
				};
			}

			case "export":
				return {
					content: <ExportScreen trip={screen.trip} onBack={goBack} />,
					menuOptions: [],
					onMenuSelect: () => {},
				};
		}
	}

	const { content, menuOptions, onMenuSelect } = getScreenConfig();

	return (
		<Page
			title={title}
			menuOptions={menuOptions}
			onMenuSelect={onMenuSelect}
			hints={hints}
			focus={focus}
		>
			{content}
		</Page>
	);
}
