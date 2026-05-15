import { Box, Text, useStdout } from "ink";
import type { JSX, ReactNode } from "react";
import { SelectInput } from "../components/atoms/SelectInput";
import { HelpBar } from "../components/molecules/HelpBar";
import type { NotificationSeverity } from "../models";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNotification } from "../states/notification";

interface DefaultLayoutProps {
	title: string;
	children: ReactNode;
}

const SEVERITY_COLORS: Record<NotificationSeverity, string> = {
	info: "cyan",
	warn: "yellow",
	error: "red",
};

export function Default({ title, children }: DefaultLayoutProps): JSX.Element {
	const { focus } = useFocus();
	const { hints, colors } = useLayout();
	const {
		options: menuOptions,
		onSelect: onMenuSelect,
		armedHint,
		trigger,
	} = useMenu();
	const { stdout } = useStdout();
	const { current } = useNotification();

	const terminalRows = stdout?.rows ?? 24;
	const hasMenu = menuOptions.length > 0 && onMenuSelect !== null;

	const titleHeight = 1;
	const mainBorderHeight = 2;
	const menuHeight = hasMenu ? 3 : 0;
	const helpHeight = 1;
	const reserved = titleHeight + mainBorderHeight + menuHeight + helpHeight;
	const mainHeight = Math.max(3, terminalRows - reserved);

	const activeBorderColor = colors.border ?? "cyan";
	const mainBorderColor =
		focus === "main" || focus === "input" ? activeBorderColor : "gray";
	const menuBorderColor = focus === "menu" ? activeBorderColor : "gray";
	const titleColor = colors.title ?? "cyan";

	return (
		<Box flexDirection="column" width="100%">
			<Box justifyContent="space-between" paddingX={1}>
				<Text bold color={titleColor}>
					{title}
				</Text>
				{current !== null && (
					<Text color={SEVERITY_COLORS[current.severity]}>{current.text}</Text>
				)}
			</Box>

			<Box
				borderStyle="round"
				borderColor={mainBorderColor}
				paddingX={1}
				height={mainHeight}
				flexDirection="column"
			>
				{children}
				{armedHint !== null && <Text color="red">{armedHint}</Text>}
			</Box>

			{hasMenu && (
				<Box borderStyle="round" borderColor={menuBorderColor}>
					<SelectInput
						options={menuOptions}
						onChange={(value) => trigger(value, focus)}
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
