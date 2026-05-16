import { describe, expect, test } from "bun:test";
import { NotificationStore } from "../notificationStore";

describe("NotificationStore", () => {
	test("initial state is empty", () => {
		const store = new NotificationStore();
		expect(store.getCurrent()).toBeNull();
		expect(store.getHistory()).toEqual([]);
	});

	test("notify sets current with the given fields", () => {
		const store = new NotificationStore({
			schedule: () => 0,
			cancel: () => {},
		});
		store.notify(
			"hello",
			{ path: "/trips", trip: "Japan", severity: "info" },
			{ now: () => new Date(0) },
		);
		const current = store.getCurrent();
		expect(current).not.toBeNull();
		expect(current?.text).toBe("hello");
		expect(current?.context).toEqual({
			path: "/trips",
			trip: "Japan",
			severity: "info",
			firedAt: new Date(0),
		});
		expect(typeof current?.id).toBe("string");
		expect(current?.id.length).toBeGreaterThan(0);
	});

	test("notify accepts context without trip", () => {
		const store = new NotificationStore({
			schedule: () => 0,
			cancel: () => {},
		});
		store.notify("hello", { path: "/trips/new", severity: "info" });
		const ctx = store.getCurrent()?.context;
		expect(ctx?.path).toBe("/trips/new");
		expect(ctx?.severity).toBe("info");
		expect(ctx?.firedAt).toBeInstanceOf(Date);
	});

	test("notify appends to history in fire order", () => {
		const store = new NotificationStore({
			schedule: () => 0,
			cancel: () => {},
		});
		store.notify("first", { path: "/a", severity: "info" });
		store.notify("second", { path: "/b", severity: "warn" });
		const history = store.getHistory();
		expect(history.length).toBe(2);
		expect(history[0]?.text).toBe("first");
		expect(history[1]?.text).toBe("second");
	});

	test("notify replaces current with the new notification (latest wins)", () => {
		const store = new NotificationStore({
			schedule: () => 0,
			cancel: () => {},
		});
		store.notify("first", { path: "/a", severity: "info" });
		store.notify("second", { path: "/b", severity: "warn" });
		expect(store.getCurrent()?.text).toBe("second");
	});

	test("dismiss clears current but leaves history intact", () => {
		const store = new NotificationStore({
			schedule: () => 0,
			cancel: () => {},
		});
		store.notify("hello", { path: "/a", severity: "info" });
		store.dismiss();
		expect(store.getCurrent()).toBeNull();
		expect(store.getHistory().length).toBe(1);
	});

	test("notify schedules auto-dismiss with 5000ms by default", () => {
		const scheduled: Array<{ ms: number; fn: () => void }> = [];
		const store = new NotificationStore({
			schedule: (fn, ms) => {
				scheduled.push({ ms, fn });
				return scheduled.length;
			},
			cancel: () => {},
		});
		store.notify("hello", { path: "/a", severity: "info" });
		expect(scheduled.length).toBe(1);
		expect(scheduled[0]?.ms).toBe(5000);
	});

	test("auto-dismiss callback clears current but keeps history", () => {
		const scheduled: Array<{ fn: () => void }> = [];
		const store = new NotificationStore({
			schedule: (fn) => {
				scheduled.push({ fn });
				return scheduled.length;
			},
			cancel: () => {},
		});
		store.notify("hello", { path: "/a", severity: "info" });
		scheduled[0]?.fn();
		expect(store.getCurrent()).toBeNull();
		expect(store.getHistory().length).toBe(1);
	});

	test("auto-dismiss callback notifies subscribers", () => {
		const scheduled: Array<{ fn: () => void }> = [];
		const store = new NotificationStore({
			schedule: (fn) => {
				scheduled.push({ fn });
				return scheduled.length;
			},
			cancel: () => {},
		});
		let calls = 0;
		store.subscribe(() => {
			calls += 1;
		});
		store.notify("hello", { path: "/a", severity: "info" });
		scheduled[0]?.fn();
		expect(calls).toBe(2);
		expect(store.getCurrent()).toBeNull();
	});

	test("persistent: true skips auto-dismiss scheduling", () => {
		const scheduled: Array<unknown> = [];
		const store = new NotificationStore({
			schedule: () => {
				scheduled.push(true);
				return 0;
			},
			cancel: () => {},
		});
		store.notify(
			"sticky",
			{ path: "/a", severity: "error" },
			{ persistent: true },
		);
		expect(scheduled.length).toBe(0);
		expect(store.getCurrent()?.text).toBe("sticky");
	});

	test("second notify cancels the prior auto-dismiss timer", () => {
		const cancels: number[] = [];
		const store = new NotificationStore({
			schedule: () => 42,
			cancel: (token) => cancels.push(token as number),
		});
		store.notify("first", { path: "/a", severity: "info" });
		store.notify("second", { path: "/b", severity: "info" });
		expect(cancels).toEqual([42]);
	});

	test("dismiss cancels the pending auto-dismiss timer", () => {
		const cancels: number[] = [];
		const store = new NotificationStore({
			schedule: () => 99,
			cancel: (token) => cancels.push(token as number),
		});
		store.notify("hello", { path: "/a", severity: "info" });
		store.dismiss();
		expect(cancels).toEqual([99]);
	});

	test("history caps at 100 with FIFO drop", () => {
		const store = new NotificationStore({
			schedule: () => 0,
			cancel: () => {},
		});
		for (let i = 0; i < 101; i++) {
			store.notify(`msg-${i}`, { path: "/a", severity: "info" });
		}
		const history = store.getHistory();
		expect(history.length).toBe(100);
		expect(history[0]?.text).toBe("msg-1");
		expect(history[99]?.text).toBe("msg-100");
	});

	test("subscribe is called whenever current or history changes", () => {
		const store = new NotificationStore({
			schedule: () => 0,
			cancel: () => {},
		});
		let calls = 0;
		const unsubscribe = store.subscribe(() => {
			calls += 1;
		});
		store.notify("a", { path: "/a", severity: "info" });
		store.notify("b", { path: "/b", severity: "info" });
		store.dismiss();
		expect(calls).toBe(3);
		unsubscribe();
		store.notify("c", { path: "/c", severity: "info" });
		expect(calls).toBe(3);
	});
});
