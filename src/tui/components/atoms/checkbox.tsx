import { Text } from "ink";

interface CheckboxProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

export function Checkbox({ label, checked }: CheckboxProps) {
  return (
    <Text>
      {checked ? "[x] " : "[ ] "}
      {label}
    </Text>
  );
}
