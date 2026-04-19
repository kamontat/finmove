import { Box } from "ink";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import type { Expense } from "../../core/models";
import { today } from "../../core/services/date";
import { addExpense, updateExpense } from "../../core/services/expense";
import { SelectInput } from "../components/atoms/SelectInput";
import { TextLabel } from "../components/atoms/TextLabel";
import { DateField } from "../components/molecules/DateField";
import { FormField } from "../components/molecules/FormField";
import { useData } from "../states/data";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useNavigation } from "../states/navigation";

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

export function ExpenseForm(): JSX.Element {
	const { trip, reloadTrip } = useData();
	const { goBack, currentRoute } = useNavigation();
	const { setFocus } = useFocus();
	const { setHints } = useLayout();

	const expenseId = currentRoute.props["expenseId"] as string | undefined;
	const existingExpense = trip?.expenses.find((e) => e.id === expenseId);

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

	// Enter input mode on mount
	useEffect(() => {
		setFocus("input");
		setHints([
			{ key: "enter", label: "confirm" },
			{ key: "esc", label: "back" },
		]);
	}, [setFocus, setHints]);

	if (!trip) {
		return <Box />;
	}

	const allCurrencies = ["THB", ...Object.keys(trip.settings.currencies)];

	const handleDone = () => {
		reloadTrip();
		setFocus("menu");
		goBack();
	};

	switch (step) {
		case "account":
			return (
				<Box flexDirection="column">
					<TextLabel text="Select account:" bold />
					<SelectInput
						options={trip.accounts.map((a, i) => ({
							label: `${a.name} (${a.type})`,
							value: a.id,
							key: String(i + 1),
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
				<DateField
					label="Date:"
					defaultValue={date || today()}
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
						options={trip.settings.categories.map((c, i) => ({
							label: c,
							value: c,
							key: String(i + 1),
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
						options={allCurrencies.map((c, i) => ({
							label: c,
							value: c,
							key: String(i + 1),
						}))}
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
						handleDone();
					}}
				/>
			);
	}
}
