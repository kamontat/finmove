import { useInput } from "ink";
import { useFocus } from "../states/focus";
import { useHelp } from "../states/help";
import { useNavigation } from "../states/navigation";

export function useGlobalKeys(): void {
	const { focus, toggleFocus } = useFocus();
	const { goBack, goExit } = useNavigation();
	const { toggleHelp } = useHelp();

	useInput((input, key) => {
		if (focus === "input") return;

		if (key.escape) {
			goExit();
			return;
		}

		if (input === "q") {
			goBack();
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
	});
}
