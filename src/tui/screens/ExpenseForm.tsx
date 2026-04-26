import { Box } from "ink";
import type { JSX } from "react";
import { useEffect, useMemo } from "react";
import type { Expense } from "../../core/models";
import { today } from "../../core/services/date";
import {
	addExpense,
	nextExpenseId,
	updateExpense,
} from "../../core/services/expense";
import { Form } from "../components/organisms/Form";
import type { FormFieldConfig } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function ExpenseForm(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goBack } = useNavigation();
	const { setFocus } = useFocus();
	const { setHints } = useLayout();

	const { expenseId } = useRouteProps("/trips/expenses/form");
	const existingExpense = trip?.expenses.find((e) => e.id === expenseId);

	useEffect(() => {
		setHints([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Edit field" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
	}, [setHints]);

	const fields = useMemo((): FormFieldConfig[] => {
		if (!trip) return [];

		const allCurrencies = ["THB", ...Object.keys(trip.settings.currencies)];
		const allOwnerIds = trip.owners.map((o) => o.id).join(",");

		const defaults = trip.settings.tags;
		const tagsLabel =
			defaults.length > 0 ? `Tags (auto-adds: ${defaults.join(", ")})` : "Tags";

		return [
			{
				key: "account",
				label: "Account",
				type: "select",
				required: true,
				options: trip.accounts.map((a) => ({
					label: `${a.name} (${a.type})`,
					value: a.id,
				})),
				...(existingExpense ? { defaultValue: existingExpense.accountId } : {}),
			},
			{
				key: "date",
				label: "Date",
				type: "date",
				required: true,
				defaultValue: existingExpense?.date ?? today(),
			},
			{
				key: "payee",
				label: "Payee",
				type: "text",
				required: true,
				...(existingExpense ? { defaultValue: existingExpense.payee } : {}),
			},
			{
				key: "category",
				label: "Category",
				type: "select",
				required: true,
				options: trip.settings.categories.map((c) => ({
					label: c,
					value: c,
				})),
				...(existingExpense ? { defaultValue: existingExpense.category } : {}),
			},
			{
				key: "amount",
				label: "Amount",
				type: "text",
				required: true,
				...(existingExpense
					? { defaultValue: existingExpense.amount.toString() }
					: {}),
			},
			{
				key: "currency",
				label: "Currency",
				type: "select",
				required: true,
				options: allCurrencies.map((c) => ({ label: c, value: c })),
				defaultValue: existingExpense?.currency ?? "THB",
			},
			{
				key: "exchangeRate",
				label: "Exchange Rate (1 currency = ? THB)",
				type: "text",
				...(existingExpense?.exchangeRate !== undefined
					? { defaultValue: existingExpense.exchangeRate.toString() }
					: {}),
			},
			{
				key: "owners",
				label: "Owner IDs (comma-separated, empty for all)",
				type: "text",
				placeholder: allOwnerIds,
			},
			{
				key: "description",
				label: "Description",
				type: "text",
				...(existingExpense
					? { defaultValue: existingExpense.description }
					: {}),
			},
			{
				key: "tags",
				label: tagsLabel,
				type: "text",
				placeholder: "comma-separated",
			},
		];
	}, [trip, existingExpense]);

	if (!trip) {
		return <Box />;
	}

	const handleSubmit = (values: Record<string, string>) => {
		const tagsStr = values["tags"] ?? "";
		const tags = tagsStr ? tagsStr.split(",").map((s) => s.trim()) : [];

		const ownersStr = values["owners"] ?? "";
		const ownerList =
			ownersStr.trim() === ""
				? undefined
				: ownersStr.split(",").map((s) => s.trim());

		const currency = values["currency"] ?? "THB";
		const exchangeRateStr = values["exchangeRate"] ?? "";

		const id =
			existingExpense?.id ?? nextExpenseId(trip, values["date"] ?? today());

		const expense: Expense = {
			id,
			accountId: values["account"] ?? "",
			date: values["date"] ?? "",
			payee: values["payee"] ?? "",
			category: values["category"] ?? "",
			amount: Number.parseFloat(values["amount"] ?? "0"),
			currency,
			...(exchangeRateStr && currency !== "THB"
				? { exchangeRate: Number.parseFloat(exchangeRateStr) }
				: {}),
			...(ownerList ? { owners: ownerList } : {}),
			description: values["description"] ?? "",
			tags,
		};

		if (existingExpense) {
			updateExpense(trip, expense);
		} else {
			addExpense(trip, expense);
		}

		reloadTrip();
		setFocus("menu");
		goBack();
	};

	return <Form fields={fields} onSubmit={handleSubmit} />;
}
