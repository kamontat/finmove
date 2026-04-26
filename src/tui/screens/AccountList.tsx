import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { removeAccount } from "../../core/services/account";
import { ListSelect } from "../components/molecules/ListSelect";
import { RemoveSelector } from "../components/molecules/RemoveSelector";
import { LIST_HINTS, SELECT_REMOVE_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function AccountList(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { focus, setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo, goBack } = useNavigation();

	const { selectMode } = useRouteProps("/trips/accounts");

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("account-");
	}, [clearByPrefix]);

	useEffect(() => {
		if (!trip || selectMode) return;
		setFocus(trip.accounts.length > 0 ? "main" : "menu");
	}, [trip, selectMode, setFocus]);

	useEffect(() => {
		setTitleSuffix(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasAccounts = trip.accounts.length > 0;

		if (selectMode === "remove") {
			setBorderColor("red");
			setMenu([], () => {});
			setHints(SELECT_REMOVE_HINTS);
			return;
		}

		setBorderColor(null);
		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasAccounts
					? [{ label: "Remove", value: "remove", key: "x" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/accounts/new", { props: { tripDirPath } });
				} else if (value === "remove" && hasAccounts) {
					goTo("/trips/accounts", {
						props: { tripDirPath, selectMode: "remove" },
					});
				}
			},
		);
		setHints(LIST_HINTS);
	}, [
		trip,
		selectMode,
		setMenu,
		setHints,
		setBorderColor,
		setTitleSuffix,
		goTo,
	]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
	}

	if (selectMode === "remove") {
		if (trip.accounts.length === 0) {
			return <Text dimColor>No accounts.</Text>;
		}
		return (
			<RemoveSelector
				header="Select an account to remove:"
				options={trip.accounts.map((a) => ({
					label: a.name,
					value: a.id,
					detail: `(${a.type})`,
				}))}
				onConfirm={(value) => {
					removeAccount(trip, value);
					reloadTrip();
					if (trip.accounts.length === 0) {
						goBack();
					}
				}}
			/>
		);
	}

	if (trip.accounts.length === 0) {
		return <Text dimColor>No accounts yet.</Text>;
	}

	return (
		<ListSelect
			options={trip.accounts.map((a) => ({
				label: a.name,
				value: a.id,
				detail: `(${a.type})`,
			}))}
			onChange={(accountId) => {
				goTo("/trips/accounts/edit", {
					props: { tripDirPath: trip.dirPath, accountId },
				});
			}}
			isActive={focus === "main"}
		/>
	);
}
