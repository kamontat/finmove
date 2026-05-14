import { describe, expect, test } from "bun:test";
import { MenuStore } from "../menuStore";

describe("MenuStore", () => {
  test("initial state is empty", () => {
    const store = new MenuStore();
    expect(store.getOptions()).toEqual([]);
    expect(store.getArmed()).toBeNull();
    expect(store.getActiveIndex()).toBeNull();
    expect(store.getArmedHint()).toBeNull();
  });

  test("setMenu stores options and onSelect callback", () => {
    const store = new MenuStore();
    const onSelect = (_value: string) => {};
    store.setMenu(
      [{ label: "Add", value: "add", key: "a" }],
      onSelect,
    );
    expect(store.getOptions()).toEqual([{ label: "Add", value: "add", key: "a" }]);
    expect(store.getOnSelect()).toBe(onSelect);
  });

  test("setMenu clears any prior activeIndex", () => {
    const store = new MenuStore();
    store.setActiveIndex(3);
    store.setMenu([], () => {});
    expect(store.getActiveIndex()).toBeNull();
  });

  test("setMenu clears any prior armed state", () => {
    const store = new MenuStore();
    store.setMenu(
      [{ label: "Delete", value: "delete", key: "x",
        mainAction: { confirmCount: 2, onConfirm: () => {} } }],
      () => {},
    );
    store.setActiveIndex(0);
    store.trigger("delete", "main");
    expect(store.getArmed()).not.toBeNull();
    store.setMenu([], () => {});
    expect(store.getArmed()).toBeNull();
  });
});
