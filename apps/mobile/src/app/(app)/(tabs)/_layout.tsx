import { Tabs } from "expo-router";
import { ComponentProps } from "react";
import { TabBar, TTabBarTab } from "@/ui/components";

type TTabBarRender = NonNullable<ComponentProps<typeof Tabs>["tabBar"]>;

const TABS: TTabBarTab[] = [
  { key: "rachas", label: "Rachas", icon: "racha" },
  { key: "notifications", label: "Avisos", icon: "notification" },
  { key: "profile", label: "Perfil", icon: "profile" },
];

const renderTabBar: TTabBarRender = ({ state, navigation }) => (
  <TabBar
    tabs={TABS}
    activeKey={state.routes[state.index]?.name ?? "rachas"}
    onChange={(key) => navigation.navigate(key)}
  />
);

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
      <Tabs.Screen name="rachas" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
