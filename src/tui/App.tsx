import type { JSX } from "react";
import { useEffect } from "react";
import type { AppArgs } from "../core/parseArgs";
import { useGlobalKeys } from "./hooks/useGlobalKeys";
import { Default } from "./layouts/Default";
import type { RouteEntry } from "./models";
import { routes } from "./router";
import { DataProvider, useData } from "./states/data";
import { FocusProvider, useFocus } from "./states/focus";
import { FormBufferProvider } from "./states/formBuffer";
import { HelpProvider } from "./states/help";
import { LayoutProvider, useLayout } from "./states/layout";
import { MenuProvider, useMenu } from "./states/menu";
import { NavigationProvider, useNavigation } from "./states/navigation";

function resolveInitialRoute(args: AppArgs): RouteEntry {
	if (args.trip) {
		const tripDirPath = `${args.dataDir}/${args.trip}`;
		if (args.page) {
			if (args.page === "owners") {
				return { path: "/trips/owners", props: { tripDirPath } };
			}
			if (args.page === "accounts") {
				return { path: "/trips/accounts", props: { tripDirPath } };
			}
			if (args.page === "expenses") {
				return { path: "/trips/expenses", props: { tripDirPath } };
			}
			if (args.page === "export") {
				return {
					path: "/trips/settings/export",
					props: { tripDirPath },
				};
			}
		}
		return {
			path: "/trips/overview",
			props: { tripDirPath, dataDir: args.dataDir },
		};
	}
	return { path: "/trips", props: { dataDir: args.dataDir } };
}

function Router(): JSX.Element {
	const { currentRoute } = useNavigation();
	const { setMenuAvailable } = useFocus();
	const { titleSuffix } = useLayout();
	const { options: menuOptions } = useMenu();
	const { trip } = useData();

	useGlobalKeys();

	// Sync menu availability to focus context
	const hasMenu = menuOptions.length > 0;
	useEffect(() => {
		setMenuAvailable(hasMenu);
	}, [hasMenu, setMenuAvailable]);

	const routeConfig = routes[currentRoute.path];
	const Component = routeConfig.component;

	// Build breadcrumb title from route hierarchy
	const breadcrumbs: string[] = [];

	switch (currentRoute.path) {
		case "/trips":
			breadcrumbs.push("Trips");
			break;
		case "/trips/new":
			breadcrumbs.push(
				"Trips",
				currentRoute.props.duplicateFromDirPath ? "Duplicate" : "New",
			);
			break;
		case "/trips/delete":
			breadcrumbs.push("Trips", "Delete");
			break;
		case "/trips/duplicate":
			breadcrumbs.push("Trips", "Duplicate");
			break;
		default: {
			breadcrumbs.push("Trips");
			if (trip) {
				breadcrumbs.push(trip.settings.name);
			}
			switch (currentRoute.path) {
				case "/trips/owners":
					breadcrumbs.push("Owners");
					break;
				case "/trips/owners/new":
					breadcrumbs.push("Owners", "New");
					break;
				case "/trips/owners/edit":
					breadcrumbs.push("Owners", "Edit");
					break;
				case "/trips/owners/delete":
					breadcrumbs.push("Owners", "Delete");
					break;
				case "/trips/owners/references":
					breadcrumbs.push("Owners", "References");
					break;
				case "/trips/accounts":
					breadcrumbs.push("Accounts");
					break;
				case "/trips/accounts/new":
					breadcrumbs.push("Accounts", "New");
					break;
				case "/trips/accounts/edit":
					breadcrumbs.push("Accounts", "Edit");
					break;
				case "/trips/accounts/delete":
					breadcrumbs.push("Accounts", "Delete");
					break;
				case "/trips/accounts/references":
					breadcrumbs.push("Accounts", "References");
					break;
				case "/trips/expenses":
					breadcrumbs.push("Expenses");
					break;
				case "/trips/expenses/delete":
					breadcrumbs.push("Expenses", "Delete");
					break;
				case "/trips/expenses/duplicate":
					breadcrumbs.push("Expenses", "Duplicate");
					break;
				case "/trips/expenses/form":
					breadcrumbs.push(
						"Expenses",
						currentRoute.props.expenseId
							? "Edit"
							: currentRoute.props.duplicateFromId
								? "Duplicate"
								: "New",
					);
					break;
			}
			break;
		}
	}

	if (titleSuffix) {
		breadcrumbs.push(titleSuffix);
	}

	const title = breadcrumbs.join(" > ");

	return (
		<Default title={title}>
			<Component />
		</Default>
	);
}

interface AppProps {
	args: AppArgs;
}

export function App({ args }: AppProps): JSX.Element {
	const initial = resolveInitialRoute(args);

	return (
		<DataProvider>
			<FocusProvider>
				<HelpProvider>
					<LayoutProvider>
						<MenuProvider>
							<FormBufferProvider>
								<NavigationProvider initial={initial}>
									<Router />
								</NavigationProvider>
							</FormBufferProvider>
						</MenuProvider>
					</LayoutProvider>
				</HelpProvider>
			</FocusProvider>
		</DataProvider>
	);
}
