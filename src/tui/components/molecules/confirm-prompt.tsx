import { ConfirmInput } from "@inkjs/ui";
import { Box } from "ink";
import { TextLabel } from "../atoms/text-label";

interface ConfirmPromptProps {
  message: string;
  onConfirm: (confirmed: boolean) => void;
}

export function ConfirmPrompt({ message, onConfirm }: ConfirmPromptProps) {
  return (
    <Box flexDirection="column">
      <TextLabel text={message} bold />
      <ConfirmInput
        onConfirm={() => onConfirm(true)}
        onCancel={() => onConfirm(false)}
      />
    </Box>
  );
}
