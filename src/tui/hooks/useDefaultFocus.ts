import { useEffect } from "react";
import type { FocusZone } from "../models";
import { useFocus } from "../states/focus";

export function useDefaultFocus(zone: FocusZone): void {
	const { setFocus } = useFocus();
	useEffect(() => {
		setFocus(zone);
	}, [setFocus, zone]);
}
