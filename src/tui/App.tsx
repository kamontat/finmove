import type { JSX } from "react";
import { useEffect } from "react";
import type { AppArgs } from "../core/parseArgs";
import { useGlobalKeys } from "./hooks/useGlobalKeys";
import { Default } from "./layouts/Default";
import type { RoutePath } from "./models";
import { routes } from "./router";
import { DataProvider, useData } from "./states/data";
import { FocusProvider, useFocus } from "./states/focus";
import { HelpProvider } from "./states/help";
import { LayoutProvider, useLayout } from "./states/layout";
import { NavigationProvider, useNavigation } from "./states/navigation";

function resolveInitialRoute(args: AppArgs): {
	path: RoutePath;
	props: Record<string, unknown>;
} {
	if (args.trip) {
		const tripDirPath = `${args.dataDir}/${args.trip}`;
		const props = { tripDirPath, dataDir: args.dataDir };
		if (args.page) {
			const pageMap: Record<string, RoutePath> = {
				owners: "/trips/owners",
				accounts: "/trips/accounts",
				expenses: "/trips/expenses",
				export: "/trips/export",
			};
			const path = pageMap[args.page];
			if (path) return { path, props };
		}
		return { path: "/trips/menu", props };
	}
	return { path: "/trips", props: { dataDir: args.dataDir } };
}

function expenseFormLabel(props: Record<string, unknown>): string {
	return props["expenseId"] ? "Edit" : "New";
}

function Router(): JSX.Element {
	const { currentRoute } = useNavigation();
	const { setMenuAvailable } = useFocus();
	const { menuOptions, titleSuffix } = useLayout();
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
	const path = currentRoute.path;

	if (path === "/trips") {
		breadcrumbs.push("Trips");
	} else {
		breadcrumbs.push("Trips");
		if (trip) {
			breadcrumbs.push(trip.settings.name);
		}
		if (path === "/trips/owners") breadcrumbs.push("Owners");
		else if (path === "/trips/accounts") breadcrumbs.push("Accounts");
		else if (path === "/trips/expenses") breadcrumbs.push("Expenses");
		else if (path === "/trips/expenses/form")
			breadcrumbs.push("Expenses", expenseFormLabel(currentRoute.props));
		else if (path === "/trips/export") breadcrumbs.push("Export");
	}

	if (titleSuffix) {
		breadcrumbs.push(titleSuffix);
	}

	const title = breadcrumbs.join(" > ");

	return (
		<Default
			title={title}
			{...(routeConfig.borderColor !== undefined
				? { defaultBorderColor: routeConfig.borderColor }
				: {})}
		>
			<Component />
		</Default>
	);
}

interface AppProps {
	args: AppArgs;
}

export function App({ args }: AppProps): JSX.Element {
	const { path, props } = resolveInitialRoute(args);

	return (
		<DataProvider>
			<FocusProvider>
				<HelpProvider>
					<LayoutProvider>
						<NavigationProvider initialPath={path} initialProps={props}>
							<Router />
						</NavigationProvider>
					</LayoutProvider>
				</HelpProvider>
			</FocusProvider>
		</DataProvider>
	);
}
