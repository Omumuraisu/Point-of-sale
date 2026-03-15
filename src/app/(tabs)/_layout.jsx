import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: "POS",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: "Sales",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="category"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
