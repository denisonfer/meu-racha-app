import { TThemeColor } from "@/ui/theme";
import { PropsWithChildren, ReactNode } from "react";
import { ViewProps } from "react-native";

export type TScreenProps = ViewProps &
  PropsWithChildren & {
    headerComponent?: ReactNode;
    isScrollable?: boolean;
    title?: string;
    canGoBack?: boolean;
    backgroundColor?: TThemeColor;
  };
