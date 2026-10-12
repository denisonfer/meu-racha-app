import { useLocalSearchParams } from "expo-router";
import { ReportSheet } from "./report-sheet";

// O nome vem por parâmetro: pelo Convite a pessoa ainda não lê o Racha.
export const ReportRachaSheetScreen = () => {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();

  return (
    <ReportSheet
      target={{ kind: "racha", id, name: name ?? "", onBlock: null }}
    />
  );
};
