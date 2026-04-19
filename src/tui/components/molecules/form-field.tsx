import { Box } from "ink";
import { TextLabel } from "../atoms/text-label";
import { TextInput } from "../atoms/text-input";

interface FormFieldProps {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
}

export function FormField({ label, placeholder, defaultValue, onSubmit }: FormFieldProps) {
  return (
    <Box flexDirection="column">
      <TextLabel text={label} bold />
      <TextInput
        {...(placeholder !== undefined ? { placeholder } : {})}
        {...(defaultValue !== undefined ? { defaultValue } : {})}
        onSubmit={onSubmit}
      />
    </Box>
  );
}
