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
});
