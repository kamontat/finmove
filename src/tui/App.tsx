import type { JSX } from "react";
import { useEffect } from "react";
import type { AppArgs } from "../core/parseArgs";
import { useGlobalKeys } from "./hooks/useGlobalKeys";
import { Default } from "./layouts/Default";
import type { RouteEntry } from "./models";
import { routes } from "./router";
import { DataProvider } from "./states/data";
import { ExpenseListSortProvider } from "./states/expenseListSort";
import { FocusProvider, useFocus } from "./states/focus";
import { FormBufferProvider } from "./states/formBuffer";
import { HelpProvider } from "./states/help";
import { LayoutProvider, useLayout } from "./states/layout";
import { MenuProvider, useMenu } from "./states/menu";
import { NavigationProvider, useNavigation } from "./states/navigation";
import { NotificationProvider } from "./states/notification";

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
	const { title } = useLayout();
	const { options: menuOptions } = useMenu();

	useGlobalKeys();

	const hasMenu = menuOptions.length > 0;
	useEffect(() => {
		setMenuAvailable(hasMenu);
	}, [hasMenu, setMenuAvailable]);

	const routeConfig = routes[currentRoute.path];
	const Component = routeConfig.component;

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
								<ExpenseListSortProvider>
									<NavigationProvider initial={initial} routes={routes}>
										<NotificationProvider>
											<Router />
										</NotificationProvider>
									</NavigationProvider>
								</ExpenseListSortProvider>
							</FormBufferProvider>
						</MenuProvider>
					</LayoutProvider>
				</HelpProvider>
			</FocusProvider>
		</DataProvider>
	);
}
