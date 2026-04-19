import { TextInput as InkTextInput } from "@inkjs/ui";

interface TextInputProps {
  placeholder?: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
}

export function TextInput({ placeholder, defaultValue, onSubmit }: TextInputProps) {
  return (
    <InkTextInput
      {...(placeholder !== undefined ? { placeholder } : {})}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      onSubmit={onSubmit}
    />
  );
}
