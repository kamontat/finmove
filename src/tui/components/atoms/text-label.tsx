import { Text } from "ink";

interface TextLabelProps {
  text: string;
  bold?: boolean;
  color?: string;
  dimColor?: boolean;
}

export function TextLabel({ text, bold, color, dimColor }: TextLabelProps) {
  return (
    <Text
      {...(bold !== undefined ? { bold } : {})}
      {...(color !== undefined ? { color: color as string } : {})}
      {...(dimColor !== undefined ? { dimColor } : {})}
    >
      {text}
    </Text>
  );
}
