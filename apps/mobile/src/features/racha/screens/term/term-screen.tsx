import { BottomSheet, Text } from "@/ui/components";
import { useTermScreen } from "./use-term-screen";

export const TermScreen = () => {
  const entry = useTermScreen();

  if (!entry) return null;

  return (
    <BottomSheet title={entry.title}>
      <Text>{entry.text}</Text>
    </BottomSheet>
  );
};
