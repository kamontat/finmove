import { Select } from "@inkjs/ui";
import type { JSX } from "react";

export interface SelectOption {
	label: string;
	value: string;
}

interface SelectInputProps {
	options: SelectOption[];
	onChange: (value: string) => void;
}

export function SelectInput({
	options,
	onChange,
}: SelectInputProps): JSX.Element {
	return <Select options={options} onChange={onChange} />;
}
