import { Box, Text } from "ink";
import type { JSX, ReactNode } from "react";
import type { SelectOption } from "../atoms/SelectInput";
import { SelectInput } from "../atoms/SelectInput";
import type { HelpHint } from "../molecules/HelpBar";
import { HelpBar } from "../molecules/HelpBar";

interface PageProps {
	title: string;
	children: ReactNode;
	menuOptions: SelectOption[];
	onMenuSelect: (value: string) => void;
	hints: HelpHint[];
	focus: "main" | "menu";
}

export function Page({
	title,
	children,
	menuOptions,
	onMenuSelect,
	hints,
	focus,
}: PageProps): JSX.Element {
	return (
		<Box flexDirection="column" gap={0}>
			<Text bold color="cyan">
				{" "}
				{title}
			</Text>
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor={focus === "main" ? "cyan" : "gray"}
				paddingX={1}
			>
				{children}
			</Box>
			{menuOptions.length > 0 && (
				<Box
					paddingX={1}
					borderStyle="round"
					borderColor={focus === "menu" ? "cyan" : "gray"}
				>
					<SelectInput
						options={menuOptions}
						onChange={onMenuSelect}
						isActive={focus === "menu"}
					/>
				</Box>
			)}
			<Box paddingX={1}>
				<HelpBar hints={hints} />
			</Box>
		</Box>
	);
}
