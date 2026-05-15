import type { NotificationSeverity } from "../models";

export const SEVERITY_COLORS: Record<NotificationSeverity, string> = {
	info: "cyan",
	warn: "yellow",
	error: "red",
};

export const SEVERITY_LABELS: Record<NotificationSeverity, string> = {
	info: "INFO",
	warn: "WARN",
	error: "ERROR",
};
