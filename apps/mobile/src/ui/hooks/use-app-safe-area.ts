import { theme } from "@/ui/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function useAppSafeArea() {
  const { top, bottom } = useSafeAreaInsets();
  const { space } = theme;

  return {
    top: Math.max(top, space[24]),
    bottom: Math.max(bottom, space[24]),
  };
}
