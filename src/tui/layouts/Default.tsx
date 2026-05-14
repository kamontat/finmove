import { Box, Text, useStdout } from "ink";
import type { JSX, ReactNode } from "react";
import { SelectInput } from "../components/atoms/SelectInput";
import { HelpBar } from "../components/molecules/HelpBar";
import { useFocus } from "../states/focus";
import { useLayout } from "../states/layout";

interface DefaultLayoutProps {
	title: string;
	defaultBorderColor?: string;
	children: ReactNode;
}

export function Default({
	title,
	defaultBorderColor,
	children,
}: DefaultLayoutProps): JSX.Element {
	const { focus } = useFocus();
	const { menuOptions, onMenuSelect, hints, colors } = useLayout();
	const { stdout } = useStdout();

	const terminalRows = stdout?.rows ?? 24;
	const hasMenu = menuOptions.length > 0 && onMenuSelect !== null;

	// Height calculation:
	// 1 title line + 2 main borders + 3 menu (if visible) + 1 help bar
	const titleHeight = 1;
	const mainBorderHeight = 2;
	const menuHeight = hasMenu ? 3 : 0;
	const helpHeight = 1;
	const reserved = titleHeight + mainBorderHeight + menuHeight + helpHeight;
	const mainHeight = Math.max(3, terminalRows - reserved);

	const activeBorderColor = colors.border ?? defaultBorderColor ?? "cyan";
	const activeTitleColor = colors.title ?? defaultBorderColor ?? "cyan";
	const mainBorderColor =
		focus === "main" || focus === "input" ? activeBorderColor : "gray";
	const menuBorderColor = focus === "menu" ? activeBorderColor : "gray";

	return (
		<Box flexDirection="column" width="100%">
			{/* Title */}
			<Text bold color={activeTitleColor}>
				{" "}
				{title}
			</Text>

			{/* Main box */}
			<Box
				borderStyle="round"
				borderColor={mainBorderColor}
				paddingX={1}
				height={mainHeight}
			>
				{children}
			</Box>

			{/* Menu box */}
			{hasMenu && onMenuSelect && (
				<Box borderStyle="round" borderColor={menuBorderColor}>
					<SelectInput
						options={menuOptions}
						onChange={onMenuSelect}
						isActive={focus === "menu"}
					/>
				</Box>
			)}

			{/* Help bar */}
			<Box paddingX={1}>
				<HelpBar hints={hints} />
			</Box>
		</Box>
	);
}
