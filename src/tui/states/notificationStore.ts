import type { Notification, NotificationSeverity } from "../models";

const MAX_HISTORY = 100;
const AUTO_DISMISS_MS = 5000;

interface NotificationStoreOptions {
	schedule?: (fn: () => void, ms: number) => unknown;
	cancel?: (token: unknown) => void;
}

interface NotifyOptions {
	persistent?: boolean;
	now?: () => Date;
}

type Listener = () => void;

export class NotificationStore {
	private current: Notification | null = null;
	private history: Notification[] = [];
	private listeners: Set<Listener> = new Set();
	private timerToken: unknown = null;
	private readonly schedule: (fn: () => void, ms: number) => unknown;
	private readonly cancel: (token: unknown) => void;

	constructor(options: NotificationStoreOptions = {}) {
		this.schedule =
			options.schedule ?? ((fn, ms) => setTimeout(fn, ms) as unknown);
		this.cancel =
			options.cancel ??
			((token) => clearTimeout(token as ReturnType<typeof setTimeout>));
	}

	getCurrent(): Notification | null {
		return this.current;
	}

	getHistory(): Notification[] {
		return this.history;
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	notify(
		text: string,
		severity: NotificationSeverity,
		route: string,
		options: NotifyOptions = {},
	): void {
		this.cancelTimer();

		const notification: Notification = {
			id: generateId(),
			text,
			severity,
			route,
			firedAt: (options.now ?? (() => new Date()))(),
		};

		this.current = notification;
		this.history = [...this.history, notification].slice(-MAX_HISTORY);

		if (options.persistent !== true) {
			this.timerToken = this.schedule(() => {
				this.timerToken = null;
				this.current = null;
				this.emit();
			}, AUTO_DISMISS_MS);
		}

		this.emit();
	}

	dismiss(): void {
		if (this.current === null) return;
		this.cancelTimer();
		this.current = null;
		this.emit();
	}

	private cancelTimer(): void {
		if (this.timerToken !== null) {
			this.cancel(this.timerToken);
			this.timerToken = null;
		}
	}

	private emit(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}
}

function generateId(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
