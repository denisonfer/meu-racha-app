import { router } from "expo-router";
import { Button, IconButton } from "@/ui/components";
import { termHelpLabel, type TTerm } from "../utils/racha-messages";

type TTermHelpProps = {
  term: TTerm;
  /** Com o texto escrito; sem ele, só o "?" ao lado do termo. */
  hasLabel?: boolean;
};

export const TermHelp = ({ term, hasLabel = false }: TTermHelpProps) => {
  const label = termHelpLabel(term);
  const open = () => router.push(`/term/${term}`);

  return hasLabel ? (
    <Button title={label} preset="text" icon="help" onPress={open} />
  ) : (
    <IconButton
      icon="help"
      color="muted"
      accessibilityLabel={label}
      onPress={open}
    />
  );
};
