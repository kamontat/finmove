import { Box, Text } from "ink";
import type { JSX } from "react";
import { useEffect } from "react";
import {
	ConfigFileMissingError,
	ConfigMigrateError,
	ConfigParseError,
	ConfigUnknownVersionError,
	ConfigValidateError,
} from "../../core/configs";
import { useLayout } from "../states/layout";
import { useMenu } from "../states/menu";
import { useNavigation, useRouteProps } from "../states/navigation";

export function TripBroken(): JSX.Element {
	const { goBack } = useNavigation();
	const { setHints, setColor } = useLayout();
	const { setMenu } = useMenu();
	const { dirName, dirPath, error } = useRouteProps("/trips/broken");

	useEffect(() => {
		setColor({ border: "red", title: "red" });
		setMenu([{ label: "Back", value: "back", key: "q" }], (value) => {
			if (value === "back") goBack();
		});
		setHints([{ key: "q", label: "Back to trip list" }]);
	}, [setColor, setMenu, setHints, goBack]);

	return (
		<Box flexDirection="column" gap={1}>
			<Text bold color="red">
				Trip "{dirName}" cannot be opened
			</Text>
			<Text dimColor>Path: {dirPath}</Text>
			<Text color="red">
				{error.name}: {error.message}
			</Text>
			{error instanceof ConfigValidateError && (
				<Box flexDirection="column" marginTop={1}>
					<Text bold>Schema issues (v{error.version}):</Text>
					{error.issues.map((issue) => (
						<Text key={issue.path.join(".") + issue.message}>
							• {issue.path.join(".") || "(root)"}: {issue.message}
						</Text>
					))}
				</Box>
			)}
			{error instanceof ConfigParseError && (
				<Box marginTop={1}>
					<Text>Offending file: {error.file}</Text>
				</Box>
			)}
			{error instanceof ConfigFileMissingError && (
				<Box marginTop={1}>
					<Text>Missing file: {error.file}</Text>
				</Box>
			)}
			{error instanceof ConfigMigrateError && (
				<Box marginTop={1}>
					<Text>
						Migration v{error.from} → v{error.to} failed.
					</Text>
				</Box>
			)}
			{error instanceof ConfigUnknownVersionError && (
				<Box marginTop={1}>
					<Text>
						File reports v{error.version}; this build supports up to v
						{error.latest}.
					</Text>
				</Box>
			)}
			<Box marginTop={1}>
				<Text dimColor>
					Edit the file manually and return to the trip list, or press [q] to go
					back.
				</Text>
			</Box>
		</Box>
	);
}
