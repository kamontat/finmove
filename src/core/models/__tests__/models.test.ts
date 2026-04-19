import { describe, expect, test } from "bun:test";
import { AccountType, SplitType } from "../index";
import type {
  Account,
  CurrencyConfig,
  Expense,
  ExpenseOwnerSplit,
  Owner,
  Settings,
  Trip,
} from "../index";

describe("core models", () => {
  test("AccountType enum has correct values", () => {
    expect(AccountType.Credit).toBe("Credit");
    expect(AccountType.Debit).toBe("Debit");
  });

  test("SplitType enum has correct values", () => {
    expect(SplitType.Equal).toBe("Equal");
    expect(SplitType.Percentage).toBe("Percentage");
    expect(SplitType.Amount).toBe("Amount");
  });

  test("types are structurally sound", () => {
    const owner: Owner = { id: "alice", name: "Alice" };
    expect(owner.id).toBe("alice");

    const account: Account = {
      id: "a1",
      name: "Visa",
      type: AccountType.Credit,
      owners: ["alice"],
    };
    expect(account.type).toBe("Credit");

    const expense: Expense = {
      id: "e1",
      accountId: "a1",
      date: "2026-05-01",
      payee: "Test",
      category: "Eating",
      amount: 100,
      currency: "THB",
      description: "test",
      tags: [],
    };
    expect(expense.amount).toBe(100);
  });
});
