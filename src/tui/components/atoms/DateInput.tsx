import { Text, useInput } from "ink";
import type { JSX } from "react";
import { useState } from "react";

interface DateInputProps {
	defaultValue: string;
	onSubmit: (value: string) => void;
	onCancel?: () => void;
}

type Segment = "year" | "month" | "day";
const SEGMENTS: Segment[] = ["year", "month", "day"];

function parseParts(dateStr: string): {
	year: number;
	month: number;
	day: number;
} {
	const parts = dateStr.split("-").map(Number);
	return { year: parts[0] ?? 2026, month: parts[1] ?? 1, day: parts[2] ?? 1 };
}

function daysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

function adjust(
	parts: { year: number; month: number; day: number },
	segment: Segment,
	delta: number,
): { year: number; month: number; day: number } {
	let { year, month, day } = parts;

	if (segment === "year") {
		year += delta;
	} else if (segment === "month") {
		month += delta;
		if (month > 12) {
			month = 1;
		} else if (month < 1) {
			month = 12;
		}
	} else {
		const max = daysInMonth(year, month);
		day += delta;
		if (day > max) {
			day = 1;
		} else if (day < 1) {
			day = daysInMonth(year, month);
		}
	}

	// Clamp day to valid range after year/month change
	const maxDay = daysInMonth(year, month);
	if (day > maxDay) {
		day = maxDay;
	}

	return { year, month, day };
}

function format(parts: { year: number; month: number; day: number }): string {
	const y = String(parts.year);
	const m = String(parts.month).padStart(2, "0");
	const d = String(parts.day).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function DateInput({
	defaultValue,
	onSubmit,
	onCancel,
}: DateInputProps): JSX.Element {
	const [parts, setParts] = useState(() => parseParts(defaultValue));
	const [segment, setSegment] = useState<Segment>("day");

	useInput((_input, key) => {
		if (key.upArrow) {
			setParts((p) => adjust(p, segment, 1));
		} else if (key.downArrow) {
			setParts((p) => adjust(p, segment, -1));
		} else if (key.leftArrow) {
			setSegment((s) => {
				const i = SEGMENTS.indexOf(s);
				return SEGMENTS[Math.max(0, i - 1)] ?? s;
			});
		} else if (key.rightArrow) {
			setSegment((s) => {
				const i = SEGMENTS.indexOf(s);
				return SEGMENTS[Math.min(SEGMENTS.length - 1, i + 1)] ?? s;
			});
		} else if (key.return) {
			onSubmit(format(parts));
		} else if (key.escape && onCancel) {
			onCancel();
		}
	});

	const y = String(parts.year);
	const m = String(parts.month).padStart(2, "0");
	const d = String(parts.day).padStart(2, "0");

	const active = (s: Segment) =>
		segment === s
			? { color: "cyan" as const, bold: true, underline: true }
			: {};

	return (
		<Text>
			<Text {...active("year")}>{y}</Text>
			<Text>-</Text>
			<Text {...active("month")}>{m}</Text>
			<Text>-</Text>
			<Text {...active("day")}>{d}</Text>
			<Text dimColor> (←/→ select, ↑/↓ change, Enter confirm)</Text>
		</Text>
	);
}
