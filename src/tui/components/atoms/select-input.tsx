import { Select } from "@inkjs/ui";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectInputProps {
  options: SelectOption[];
  onChange: (value: string) => void;
}

export function SelectInput({ options, onChange }: SelectInputProps) {
  return <Select options={options} onChange={onChange} />;
}
