import type { HelpHint } from "../models";

export const LIST_HINTS: HelpHint[] = [
	{ key: "tab", label: "Switch focus" },
	{ key: "←→", label: "Navigate menu" },
	{ key: "Enter", label: "Confirm" },
	{ key: "q/esc", label: "Back" },
	{ key: "e", label: "Exit" },
];

export const FORM_HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Edit field" },
	{ key: "q/esc", label: "Back" },
	{ key: "e", label: "Exit" },
];

export const SELECT_REMOVE_HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Remove selected" },
	{ key: "q/esc", label: "Back to list" },
	{ key: "e", label: "Exit" },
];

export const SELECT_DUPLICATE_HINTS: HelpHint[] = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Duplicate" },
	{ key: "q/esc", label: "Back to list" },
	{ key: "e", label: "Exit" },
];
