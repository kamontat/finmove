import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import { SEVERITY_COLORS, SEVERITY_LABELS } from "../constants/severity";
import type { Notification } from "../models";
import { useLayout } from "../states/layout";
import { useNotification } from "../states/notification";

function formatTime(date: Date): string {
	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");
	const ss = String(date.getSeconds()).padStart(2, "0");
	return `${hh}:${mm}:${ss}`;
}

export function NotificationList(): JSX.Element {
	const { history } = useNotification();
	const { setHints } = useLayout();

	useEffect(() => {
		setHints([
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
	}, [setHints]);

	if (history.length === 0) {
		return (
			<Box>
				<Text dimColor>No notifications yet.</Text>
			</Box>
		);
	}

	const rows: Notification[] = [...history].reverse();

	return (
		<Box flexDirection="column">
			<Box>
				<Box width={10}>
					<Text bold>Time</Text>
				</Box>
				<Box width={8}>
					<Text bold>Level</Text>
				</Box>
				<Box width="40%">
					<Text bold>Screen</Text>
				</Box>
				<Box flexGrow={1}>
					<Text bold>Message</Text>
				</Box>
			</Box>
			{rows.map((n) => (
				<Box key={n.id}>
					<Box width={10}>
						<Text>{formatTime(n.firedAt)}</Text>
					</Box>
					<Box width={8}>
						<Text color={SEVERITY_COLORS[n.severity]}>
							{SEVERITY_LABELS[n.severity]}
						</Text>
					</Box>
					<Box width="40%">
						<Text>{n.route}</Text>
					</Box>
					<Box flexGrow={1}>
						<Text>{n.text}</Text>
					</Box>
				</Box>
			))}
		</Box>
	);
}
