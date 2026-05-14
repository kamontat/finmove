import { Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { ListSelect } from "../components/molecules/ListSelect";
import { LIST_HINTS } from "../constants/hints";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useFormBufferAdmin } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

export function AccountList(): JSX.Element {
	const { trip } = useData();
	const { focus, setFocus } = useFocus();
	const { setMenu, setHints, setBorderColor, setTitleSuffix } = useLayout();
	const { goTo } = useNavigation();

	const { clearByPrefix } = useFormBufferAdmin();
	useEffect(() => {
		clearByPrefix("account-");
	}, [clearByPrefix]);

	useEffect(() => {
		if (!trip) return;
		setFocus(trip.accounts.length > 0 ? "main" : "menu");
	}, [trip, setFocus]);

	useEffect(() => {
		setTitleSuffix(null);
		setBorderColor(null);
		if (!trip) return;

		const tripDirPath = trip.dirPath;
		const hasAccounts = trip.accounts.length > 0;

		setMenu(
			[
				{ label: "Add", value: "add", key: "a" },
				...(hasAccounts
					? [{ label: "Delete", value: "delete", key: "x" }]
					: []),
			],
			(value) => {
				if (value === "add") {
					goTo("/trips/accounts/new", { props: { tripDirPath } });
				} else if (value === "delete" && hasAccounts) {
					goTo("/trips/accounts/delete", { props: { tripDirPath } });
				}
			},
		);
		setHints(LIST_HINTS);
	}, [trip, setMenu, setHints, setBorderColor, setTitleSuffix, goTo]);

	if (!trip) {
		return <Text dimColor>Loading...</Text>;
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
