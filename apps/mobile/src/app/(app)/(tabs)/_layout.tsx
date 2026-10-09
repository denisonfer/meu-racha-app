import { Tabs } from "expo-router";
import { ComponentProps } from "react";
import {
  tabBadgeA11y,
  useUnseenNotificationsCount,
} from "@/features/notification";
import { TabBar, TTabBarTab } from "@/ui/components";

type TTabBarRender = NonNullable<ComponentProps<typeof Tabs>["tabBar"]>;
type TTabsBarProps = Parameters<TTabBarRender>[0];

const TABS: TTabBarTab[] = [
  { key: "rachas", label: "Rachas", icon: "racha" },
  { key: "notifications", label: "Avisos", icon: "notification" },
  { key: "profile", label: "Perfil", icon: "profile" },
];

function TabsBar({ state, navigation }: TTabsBarProps) {
  const unseen = useUnseenNotificationsCount();

  const tabs = TABS.map((tab) =>
    tab.key === "notifications" ? { ...tab, badgeCount: unseen.data } : tab
  );

  return (
    <TabBar
      tabs={tabs}
      activeKey={state.routes[state.index]?.name ?? "rachas"}
      onChange={(key) => navigation.navigate(key)}
      badgeA11y={tabBadgeA11y}
    />
  );
}

const renderTabBar: TTabBarRender = (props) => <TabsBar {...props} />;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
      <Tabs.Screen name="rachas" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
