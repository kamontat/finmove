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
	const { setHints, setTitleSuffix } = useLayout();

	const { expenseId, tripDirPath, duplicateFromId } = useRouteProps(
		"/trips/expenses/form",
	);
	const existingExpense = trip?.expenses.find((e) => e.id === expenseId);
	const duplicateSource = duplicateFromId
		? trip?.expenses.find((e) => e.id === duplicateFromId)
		: undefined;
	const sourceForDefaults = existingExpense ?? duplicateSource;
	const isDuplicate = !existingExpense && !!duplicateSource;

	const formId = expenseId
		? `expense-edit-${expenseId}`
		: duplicateFromId
			? `expense-duplicate-${duplicateFromId}`
			: "expense-new";
	const buffer = useFormBuffer(formId);

	useEffect(() => {
		setHints([
			{ key: "↑↓", label: "Navigate" },
			{ key: "Enter", label: "Edit field" },
			{ key: "q/esc", label: "Back" },
			{ key: "e", label: "Exit" },
		]);
	}, [setHints]);

	useEffect(() => {
		if (isDuplicate && duplicateSource) {
			setTitleSuffix(duplicateSource.payee);
		} else {
			setTitleSuffix(null);
		}
		return () => setTitleSuffix(null);
	}, [isDuplicate, duplicateSource, setTitleSuffix]);

	// Seed buffer with existing expense's owners + tags on mount (edit mode only)
	useEffect(() => {
		const source = existingExpense ?? duplicateSource;
		if (!source) return;
		if (buffer.values["owners"] === undefined) {
			const ownerIds = Array.isArray(source.owners)
				? source.owners.map((o) => (typeof o === "string" ? o : o.id))
				: [];
			buffer.setField("owners", ownerIds);
		}
		if (buffer.values["tags"] === undefined) {
			buffer.setField("tags", source.tags);
		}
	}, [existingExpense, duplicateSource, buffer]);

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
				onEdit: () =>
					goTo("/trips/expenses/form/account", {
						props: { tripDirPath, formId, fieldKey: "account" },
					}),
				...(sourceForDefaults
					? { defaultValue: sourceForDefaults.accountId }
					: {}),
			},
			{
				key: "date",
				label: "Date",
				type: "date",
				required: true,
				defaultValue: sourceForDefaults?.date ?? today(),
			},
			{
				key: "payee",
				label: "Payee",
				type: "text",
				required: true,
				...(sourceForDefaults ? { defaultValue: sourceForDefaults.payee } : {}),
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
				onEdit: () =>
					goTo("/trips/expenses/form/category", {
						props: { tripDirPath, formId, fieldKey: "category" },
					}),
				...(sourceForDefaults
					? { defaultValue: sourceForDefaults.category }
					: {}),
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
				onEdit: () =>
					goTo("/trips/expenses/form/currency", {
						props: { tripDirPath, formId, fieldKey: "currency" },
					}),
				defaultValue: sourceForDefaults?.currency ?? "THB",
			},
			{
				key: "exchangeRate",
				label: "Exchange Rate (1 currency = ? THB)",
				type: "text",
				...(sourceForDefaults?.exchangeRate !== undefined
					? { defaultValue: sourceForDefaults.exchangeRate.toString() }
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
				...(sourceForDefaults
					? { defaultValue: sourceForDefaults.description }
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
	}, [trip, existingExpense, sourceForDefaults, goTo, tripDirPath, formId]);

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
