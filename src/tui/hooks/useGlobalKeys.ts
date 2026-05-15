import { useInput } from "ink";
import { useFocus } from "../states/focus";
import { useHelp } from "../states/help";
import { useNavigation } from "../states/navigation";
import { useNotification } from "../states/notification";

export function useGlobalKeys(): void {
	const { focus, toggleFocus } = useFocus();
	const { currentRoute, goBack, goExit, goTo } = useNavigation();
	const { toggleHelp } = useHelp();
	const { current, history, dismiss } = useNotification();

	useInput((input, key) => {
		if (focus === "input") return;

		if (key.escape) {
			goBack();
			return;
		}

		if (input === "q") {
			goBack();
			return;
		}

		if (input === "e") {
			goExit();
			return;
		}

		if (key.tab) {
			toggleFocus();
			return;
		}

		if (input === "?") {
			toggleHelp();
			return;
		}

		if (input === "m" && current !== null) {
			dismiss();
			return;
		}

		if (
			input === "n" &&
			history.length > 0 &&
			currentRoute.path !== "/notifications"
		) {
			goTo("/notifications");
			return;
		}
	});
}
