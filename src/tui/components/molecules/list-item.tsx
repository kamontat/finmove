import { Box, Text } from "ink";

interface ListItemProps {
  icon?: string;
  label: string;
  detail?: string;
}

export function ListItem({ icon, label, detail }: ListItemProps) {
  return (
    <Box gap={1}>
      {icon && <Text>{icon}</Text>}
      <Text>{label}</Text>
      {detail && <Text dimColor>{detail}</Text>}
    </Box>
  );
}
