import { Box, Text } from "ink";
import type { JSX } from "react";
import { AccountType } from "../../../core/models";
import type { TripStatus } from "../../../core/services/trip";
import { ScrollableMain } from "../molecules/ScrollableMain";

interface Props {
	status: TripStatus;
}

interface DashboardProps extends Props {
	isActive: boolean;
}

const PHASE_COLOR: Record<TripStatus["phase"], string> = {
	upcoming: "blue",
	ongoing: "green",
	ended: "gray",
};

const PHASE_LABEL: Record<TripStatus["phase"], string> = {
	upcoming: "Upcoming",
	ongoing: "Ongoing",
	ended: "Ended",
};

function formatThb(amount: number): string {
	return `฿${amount.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function formatOriginal(currency: string, amount: number): string {
	return `${currency} ${amount.toLocaleString("en-US")}`;
}

function StatusHeader({ status }: Props): JSX.Element {
	return (
		<Box>
			<Text bold color={PHASE_COLOR[status.phase]}>
				[{PHASE_LABEL[status.phase]}]
			</Text>
			<Text>
				{"  "}
				{status.startDate} — {status.endDate}
			</Text>
			{status.countries.length > 0 && (
				<Text dimColor>{`  |  ${status.countries.join(", ")}`}</Text>
			)}
		</Box>
	);
}

function ProgressBar({ status }: Props): JSX.Element {
	const width = 20;
	const filled = Math.max(
		0,
		Math.min(
			width,
			Math.round((status.elapsedDays / Math.max(status.totalDays, 1)) * width),
		),
	);
	const empty = width - filled;
	return (
		<Box>
			<Text>[</Text>
			<Text color="green">{"█".repeat(filled)}</Text>
			<Text dimColor>{"░".repeat(empty)}</Text>
			<Text>] </Text>
			<Text>
				{status.elapsedDays}/{status.totalDays} days ({status.remainingDays}{" "}
				left)
			</Text>
		</Box>
	);
}

function SectionHeader({ label }: { label: string }): JSX.Element {
	return (
		<Box flexDirection="column">
			<Text bold color="cyan">
				{label}
			</Text>
			<Text dimColor>{"─".repeat(label.length)}</Text>
		</Box>
	);
}

function SpendBlock({ status }: Props): JSX.Element {
	const labelWidth = "By currency".length;
	return (
		<Box flexDirection="column" width={40}>
			<SectionHeader label="Spend" />
			<Box>
				<Text dimColor>{"Total".padEnd(labelWidth)}</Text>
				<Text>{"  "}</Text>
				<Text bold>{formatThb(status.totalSpendThb)}</Text>
			</Box>
			<Box>
				<Text dimColor>{"Avg/day".padEnd(labelWidth)}</Text>
				<Text>{"  "}</Text>
				<Text bold>{formatThb(status.avgPerDayThb)}</Text>
			</Box>
			{status.byCurrency.length > 0 && (
				<Box flexDirection="column">
					<Box>
						<Text dimColor>{"By currency".padEnd(labelWidth)}</Text>
						<Text>{"  "}</Text>
						{status.byCurrency[0] && (
							<Text>
								{formatOriginal(
									status.byCurrency[0].currency,
									status.byCurrency[0].amount,
								)}
							</Text>
						)}
					</Box>
					{status.byCurrency.slice(1).map((c) => (
						<Box key={c.currency}>
							<Text>{" ".repeat(labelWidth + 2)}</Text>
							<Text>{formatOriginal(c.currency, c.amount)}</Text>
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
}

function CategoriesBlock({ status }: Props): JSX.Element {
	const max = Math.max(1, ...status.topCategories.map((c) => c.amountThb));
	const labelWidth = Math.max(
		0,
		...status.topCategories.map((c) => c.category.length),
	);
	const barWidth = 8;
	return (
		<Box flexDirection="column" width={40}>
			<SectionHeader label="Top categories" />
			{status.topCategories.length === 0 ? (
				<Text dimColor>—</Text>
			) : (
				status.topCategories.map((c) => {
					const cells = Math.max(1, Math.round((c.amountThb / max) * barWidth));
					return (
						<Box key={c.category}>
							<Text>{c.category.padEnd(labelWidth)}</Text>
							<Text>{"  "}</Text>
							<Text bold>{formatThb(c.amountThb).padStart(10)}</Text>
							<Text>{"  "}</Text>
							<Text color="cyan">{"█".repeat(cells)}</Text>
						</Box>
					);
				})
			)}
		</Box>
	);
}

function formatSigned(amount: number): string {
	if (amount === 0) return formatThb(0);
	const sign = amount > 0 ? "+" : "−";
	return `${sign}${formatThb(Math.abs(amount))}`;
}

function OwnersBlock({ status }: Props): JSX.Element {
	return (
		<Box flexDirection="column" width={40}>
			<SectionHeader label="Owners" />
			{status.ownerBalances.map((o) => {
				const color =
					o.balanceThb > 0 ? "green" : o.balanceThb < 0 ? "red" : undefined;
				return (
					<Box key={o.ownerId}>
						<Text>{o.name.padEnd(14)}</Text>
						<Text bold {...(color ? { color } : { dimColor: true })}>
							{formatSigned(o.balanceThb)}
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}

function formatAccountName(name: string): string {
	if (name.length <= 12) return name.padEnd(12);
	return `${name.slice(0, 11)}…`;
}

function typeAbbrev(type: AccountType): string {
	return type === AccountType.Credit ? "Cr" : "Db";
}

function AccountsBlock({ status }: Props): JSX.Element {
	const max = Math.max(1, ...status.byAccount.map((a) => a.totalThb));
	const barWidth = 6;
	return (
		<Box flexDirection="column" width={40}>
			<SectionHeader label="Accounts" />
			{status.byAccount.map((a) => {
				const cells = Math.max(1, Math.round((a.totalThb / max) * barWidth));
				const countStr = `×${a.expenseCount}`.padStart(4);
				return (
					<Box key={a.accountId}>
						<Text>{formatAccountName(a.name)}</Text>
						<Text> </Text>
						<Text dimColor>({typeAbbrev(a.type)})</Text>
						<Text> </Text>
						<Text dimColor>{countStr}</Text>
						<Text> </Text>
						<Text bold>{formatThb(a.totalThb).padStart(10)}</Text>
						<Text> </Text>
						<Text color="magenta">{"█".repeat(cells)}</Text>
					</Box>
				);
			})}
		</Box>
	);
}

function CountsBlock({ status }: Props): JSX.Element {
	return (
		<Box flexDirection="column" width={40}>
			<SectionHeader label="Counts" />
			<Box>
				<Text dimColor>Expenses</Text>
				<Text>{"    "}</Text>
				<Text bold>{status.expenseCount}</Text>
			</Box>
			<Box>
				<Text dimColor>Accounts</Text>
				<Text>{"    "}</Text>
				<Text bold>{status.accountCount}</Text>
			</Box>
			<Box>
				<Text dimColor>Categories</Text>
				<Text>{"  "}</Text>
				<Text bold>
					{status.categoryCount.used} used / {status.categoryCount.total} total
				</Text>
			</Box>
			<Box>
				<Text dimColor>Tags</Text>
				<Text>{"        "}</Text>
				<Text bold>
					{status.tagCount.used} used / {status.tagCount.total} total
				</Text>
			</Box>
		</Box>
	);
}

function WarningList({ status }: Props): JSX.Element {
	return (
		<Box flexDirection="column">
			{status.warnings.map((w) => (
				<Text key={w} color="yellow">
					⚠ {w}
				</Text>
			))}
		</Box>
	);
}

export function TripDashboard({
	status,
	isActive,
}: DashboardProps): JSX.Element {
	const hasOwners = status.ownerBalances.length > 0;
	const hasAccountSpend = status.byAccount.length > 0;
	return (
		<ScrollableMain isActive={isActive}>
			<Box flexDirection="column" gap={1}>
				<StatusHeader status={status} />
				<ProgressBar status={status} />

				<Box flexDirection="row" flexWrap="wrap" gap={2}>
					<SpendBlock status={status} />
					{hasOwners && <OwnersBlock status={status} />}
					<CategoriesBlock status={status} />
					{hasAccountSpend && <AccountsBlock status={status} />}
					<CountsBlock status={status} />
				</Box>

				{status.warnings.length > 0 && <WarningList status={status} />}
			</Box>
		</ScrollableMain>
	);
}
