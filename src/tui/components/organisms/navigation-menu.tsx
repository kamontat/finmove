import { Box } from "ink";
import { SelectInput } from "../atoms/select-input";
import { TextLabel } from "../atoms/text-label";
import type { SelectOption } from "../atoms/select-input";

interface NavigationMenuProps {
  title: string;
  options: SelectOption[];
  onSelect: (value: string) => void;
}

export function NavigationMenu({ title, options, onSelect }: NavigationMenuProps) {
  return (
    <Box flexDirection="column" gap={1}>
      <TextLabel text={title} bold color="cyan" />
      <SelectInput options={options} onChange={onSelect} />
    </Box>
  );
}
