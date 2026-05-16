import { Text, useInput } from "ink";
import { type JSX, useState } from "react";

interface NumberInputProps {
	defaultValue?: number;
	placeholder?: string;
	onSubmit: (value: number) => void;
	onCancel?: () => void;
}

function parseNumber(s: string): number | undefined {
	const t = s.trim();
	if (t === "" || t === "-" || t === "." || t === "-.") return undefined;
	const n = Number(t);
	return Number.isFinite(n) ? n : undefined;
}

// Shift+arrow steps by one order of magnitude of the current value.
// e.g. 100 → 200, 1000 → 2000. Floors at 10 for small/zero values.
function getShiftDelta(n: number): number {
	if (n === 0) return 10;
	const mag = 10 ** Math.floor(Math.log10(Math.abs(n)));
	return Math.max(10, mag);
}

export function NumberInput({
	defaultValue,
	placeholder,
	onSubmit,
	onCancel,
}: NumberInputProps): JSX.Element {
	const [buffer, setBuffer] = useState<string>(
		defaultValue !== undefined ? String(defaultValue) : "",
	);

	useInput((input, key) => {
		if (key.escape) {
			onCancel?.();
			return;
		}
		if (key.return) {
			const parsed = parseNumber(buffer);
			if (parsed !== undefined) onSubmit(parsed);
			else onCancel?.();
			return;
		}
		if (key.upArrow || key.downArrow) {
			const sign = key.upArrow ? 1 : -1;
			const current = parseNumber(buffer) ?? 0;
			const delta = key.shift ? getShiftDelta(current) : 1;
			setBuffer(String(current + sign * delta));
			return;
		}
		if (key.backspace || key.delete) {
			setBuffer((b) => b.slice(0, -1));
			return;
		}
		if (input === "-" && buffer === "") {
			setBuffer("-");
			return;
		}
		if (input === ".") {
			setBuffer((b) => (b.includes(".") ? b : `${b}.`));
			return;
		}
		if (input >= "0" && input <= "9") {
			setBuffer((b) => `${b}${input}`);
			return;
		}
	});

	const showPlaceholder = buffer === "" && placeholder !== undefined;
	return (
		<Text>
			{showPlaceholder ? (
				<Text dimColor>{placeholder}</Text>
			) : (
				<Text>{buffer}</Text>
			)}
			<Text color="cyan">▎</Text>
		</Text>
	);
}
