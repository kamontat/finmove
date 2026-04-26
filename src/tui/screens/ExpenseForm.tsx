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
import { type FormFieldConfig, getString, getStringArray } from "../models";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useFormBuffer } from "../states/formBuffer";
import { useLayout } from "../states/layout";
import { useNavigation, useRouteProps } from "../states/navigation";

export function ExpenseForm(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goTo, goBack } = useNavigation();
	const { setFocus } = useFocus();
	const { setHints } = useLayout();

	const { expenseId, tripDirPath } = useRouteProps("/trips/expenses/form");
	const existingExpense = trip?.expenses.find((e) => e.id === expenseId);

	const formId = expenseId ? `expense-edit-${expenseId}` : "expense-new";
	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setHints([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Edit field" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
	}, [setHints]);

	// Seed buffer with existing expense's owners + tags on mount (edit mode only)
	useEffect(() => {
		if (!existingExpense) return;
		if (buffer.values["owners"] === undefined) {
			const ownerIds = Array.isArray(existingExpense.owners)
				? existingExpense.owners.map((o) => (typeof o === "string" ? o : o.id))
				: [];
			buffer.setField("owners", ownerIds);
		}
		if (buffer.values["tags"] === undefined) {
			buffer.setField("tags", existingExpense.tags);
		}
	}, [existingExpense, buffer]);

	const fields = useMemo((): FormFieldConfig[] => {
		if (!trip) return [];

		const allCurrencies = ["THB", ...Object.keys(trip.settings.currencies)];

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
				label: "Owners",
				type: "multiselect",
				required: false,
				onEdit: () =>
					goTo("/trips/expenses/form/owners", {
						props: { tripDirPath, formId, fieldKey: "owners" },
					}),
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
				label: "Tags",
				type: "multiselect",
				required: false,
				onEdit: () =>
					goTo("/trips/expenses/form/tags", {
						props: { tripDirPath, formId, fieldKey: "tags" },
					}),
			},
		];
	}, [trip, existingExpense, goTo, tripDirPath, formId]);

	if (!trip) {
		return <Box />;
	}

	const handleSubmit = (values: Record<string, string | string[]>) => {
		const tags = getStringArray(values, "tags");
		const ownerList = getStringArray(values, "owners");

		const currency = getString(values, "currency") || "THB";
		const exchangeRateStr = getString(values, "exchangeRate");

		const id =
			existingExpense?.id ??
			nextExpenseId(trip, getString(values, "date") || today());

		const expense: Expense = {
			id,
			accountId: getString(values, "account"),
			date: getString(values, "date"),
			payee: getString(values, "payee"),
			category: getString(values, "category"),
			amount: Number.parseFloat(getString(values, "amount") || "0"),
			currency,
			...(exchangeRateStr && currency !== "THB"
				? { exchangeRate: Number.parseFloat(exchangeRateStr) }
				: {}),
			...(ownerList.length > 0 ? { owners: ownerList } : {}),
			description: getString(values, "description"),
			tags,
		};

		if (existingExpense) {
			updateExpense(trip, expense);
		} else {
			addExpense(trip, expense);
		}

		reloadTrip();
		buffer.clear();
		setFocus("menu");
		goBack();
	};

	return <Form formId={formId} fields={fields} onSubmit={handleSubmit} />;
}
