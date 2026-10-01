import { ActivityIndicator } from "react-native";
import { Icon } from "../icon";
import { theme } from "@/ui/theme";
import { TInputStatus } from "./input-types";

export const StatusIcon = ({ status }: { status?: TInputStatus }) => {
  if (!status) return null;

  if (status === "checking") {
    return (
      <ActivityIndicator
        size="small"
        color={theme.colors.muted}
        accessibilityLabel="Verificando"
      />
    );
  }

  const isValid = status === "valid";

  return (
    <Icon
      name={isValid ? "success" : "error"}
      color={isValid ? "success" : "danger"}
      accessibilityLabel={isValid ? "Disponível" : "Indisponível"}
    />
  );
};
