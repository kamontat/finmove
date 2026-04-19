import { Box } from "ink";
import type { JSX } from "react";
import { useState } from "react";
import type { Expense, Trip } from "../../core/models";
import { addExpense, updateExpense } from "../../core/services/expense";
import { SelectInput } from "../components/atoms/select-input";
import { TextLabel } from "../components/atoms/text-label";
import { FormField } from "../components/molecules/form-field";

interface ExpenseFormProps {
	trip: Trip;
	existingExpense?: Expense;
	onDone: () => void;
}

type FormStep =
	| "account"
	| "date"
	| "payee"
	| "category"
	| "amount"
	| "currency"
	| "exchangeRate"
	| "owners"
	| "description"
	| "tags";

export function ExpenseForm({
	trip,
	existingExpense,
	onDone,
}: ExpenseFormProps): JSX.Element {
	const [step, setStep] = useState<FormStep>("account");
	const [accountId, setAccountId] = useState(existingExpense?.accountId ?? "");
	const [date, setDate] = useState(existingExpense?.date ?? "");
	const [payee, setPayee] = useState(existingExpense?.payee ?? "");
	const [category, setCategory] = useState(existingExpense?.category ?? "");
	const [amount, setAmount] = useState(
		existingExpense?.amount?.toString() ?? "",
	);
	const [currency, setCurrency] = useState(existingExpense?.currency ?? "THB");
	const [exchangeRate, setExchangeRate] = useState(
		existingExpense?.exchangeRate?.toString() ?? "",
	);
	const [owners, setOwners] = useState("");
	const [description, setDescription] = useState(
		existingExpense?.description ?? "",
	);

	const allCurrencies = ["THB", ...Object.keys(trip.settings.currencies)];

	switch (step) {
		case "account":
			return (
				<Box flexDirection="column">
					<TextLabel text="Select account:" bold />
					<SelectInput
						options={trip.accounts.map((a) => ({
							label: `${a.name} (${a.type})`,
							value: a.id,
						}))}
						onChange={(value) => {
							setAccountId(value);
							setStep("date");
						}}
					/>
				</Box>
			);

		case "date":
			return (
				<FormField
					label="Date (YYYY-MM-DD):"
					defaultValue={date}
					onSubmit={(v) => {
						setDate(v);
						setStep("payee");
					}}
				/>
			);

		case "payee":
			return (
				<FormField
					label="Payee:"
					defaultValue={payee}
					onSubmit={(v) => {
						setPayee(v);
						setStep("category");
					}}
				/>
			);

		case "category":
			return (
				<Box flexDirection="column">
					<TextLabel text="Category:" bold />
					<SelectInput
						options={trip.settings.categories.map((c) => ({
							label: c,
							value: c,
						}))}
						onChange={(value) => {
							setCategory(value);
							setStep("amount");
						}}
					/>
				</Box>
			);

		case "amount":
			return (
				<FormField
					label="Amount:"
					defaultValue={amount}
					onSubmit={(v) => {
						setAmount(v);
						setStep("currency");
					}}
				/>
			);

		case "currency":
			return (
				<Box flexDirection="column">
					<TextLabel text="Currency:" bold />
					<SelectInput
						options={allCurrencies.map((c) => ({ label: c, value: c }))}
						onChange={(value) => {
							setCurrency(value);
							setStep(value === "THB" ? "owners" : "exchangeRate");
						}}
					/>
				</Box>
			);

		case "exchangeRate": {
			const tripRate = trip.settings.currencies[currency]?.exchangeRate;
			return (
				<FormField
					label={`Exchange rate (1 ${currency} = ? THB)${tripRate !== undefined ? ` [default: ${tripRate}]` : ""}:`}
					onSubmit={(v) => {
						setExchangeRate(v);
						setStep("owners");
					}}
				/>
			);
		}

		case "owners":
			return (
				<FormField
					label="Expense owner IDs (comma-separated, empty for all):"
					placeholder={trip.owners.map((o) => o.id).join(",")}
					onSubmit={(v) => {
						setOwners(v);
						setStep("description");
					}}
				/>
			);

		case "description":
			return (
				<FormField
					label="Description:"
					defaultValue={description}
					onSubmit={(v) => {
						setDescription(v);
						setStep("tags");
					}}
				/>
			);

		case "tags":
			return (
				<FormField
					label="Tags (comma-separated):"
					onSubmit={(tagsStr) => {
						const tags = tagsStr ? tagsStr.split(",").map((s) => s.trim()) : [];
						const ownerList =
							owners.trim() === ""
								? undefined
								: owners.split(",").map((s) => s.trim());

						const id = existingExpense?.id ?? `exp-${Date.now()}`;

						const expense: Expense = {
							id,
							accountId,
							date,
							payee,
							category,
							amount: Number.parseFloat(amount),
							currency,
							...(exchangeRate
								? { exchangeRate: Number.parseFloat(exchangeRate) }
								: {}),
							...(ownerList ? { owners: ownerList } : {}),
							description,
							tags,
						};

						if (existingExpense) {
							updateExpense(trip, expense);
						} else {
							addExpense(trip, expense);
						}
						onDone();
					}}
				/>
			);
	}
}
