import {
  createContext,
  PropsWithChildren,
  use,
  useEffect,
  useState,
} from "react";
import { AccessibilityInfo, StyleSheet } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useAppSafeArea } from "@/ui/hooks/use-app-safe-area";
import { theme } from "@/ui/theme";
import { Icon } from "../icon";
import { Text } from "../text/text";

export type TToastTone = "success" | "danger";
export type TShowToast = (message: string, tone?: TToastTone) => void;

const ToastContext = createContext<TShowToast>(() => {});

export const useToast = () => use(ToastContext);

const DURATION = 4000;

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    tone: TToastTone;
  } | null>(null);
  const { top } = useAppSafeArea();

  useEffect(() => {
    if (!toast) return;

    AccessibilityInfo.announceForAccessibility(toast.message);

    const timer = setTimeout(() => setToast(null), DURATION);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext
      value={(message, tone = "danger") =>
        setToast({ id: Date.now(), message, tone })
      }
    >
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInUp}
          exiting={FadeOutUp}
          style={[styles.toast, { top, borderColor: theme.colors[toast.tone] }]}
        >
          <Icon
            name={toast.tone === "success" ? "success" : "error"}
            color={toast.tone}
          />
          <Text preset="small" style={styles.message}>
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}
    </ToastContext>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: theme.space[16],
    right: theme.space[16],
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space[8],
    padding: theme.space[16],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.control,
    borderWidth: 1,
  },
  message: { flex: 1 },
});
