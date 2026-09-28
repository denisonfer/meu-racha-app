import { Pressable, StyleSheet, View } from "react-native";
import { theme } from "@/ui/theme";
import { useAppSafeArea } from "@/ui/hooks/use-app-safe-area";
import { Icon } from "../icon";
import { TIconName } from "../icon/icon-map";
import { Text } from "../text/text";

export type TTabBarTab = { key: string; label: string; icon: TIconName };

export type TTabBarProps = {
  tabs: TTabBarTab[];
  activeKey: string;
  onChange: (key: string) => void;
};

export const TabBar = ({ tabs, activeKey, onChange }: TTabBarProps) => {
  const { bottom } = useAppSafeArea();

  return (
    <View
      style={[styles.bar, { paddingBottom: bottom }]}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        const color = isActive ? "foreground" : "muted";

        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View
              style={[styles.indicator, isActive && styles.indicatorActive]}
            />
            <Icon name={tab.icon} size={24} color={color} />
            <Text
              preset="caption"
              color={color}
              style={isActive && styles.labelActive}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
  },
  tab: {
    flex: 1,
    minWidth: theme.minTouch,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space[4],
  },
  pressed: { opacity: 0.7 },
  indicator: {
    position: "absolute",
    top: 0,
    left: theme.space[24],
    right: theme.space[24],
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  indicatorActive: { backgroundColor: theme.colors.action },
  labelActive: { fontFamily: "Manrope-ExtraBold" },
});
