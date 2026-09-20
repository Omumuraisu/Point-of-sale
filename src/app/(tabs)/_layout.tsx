import { Tabs } from "expo-router";
import { Redirect } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthSession } from "../../lib/authSession";
import { useTransactionSyncMonitor } from "../../lib/useTransactionSyncMonitor";
import { useTheme } from "../../lib/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { currentUser, isHydrating } = useAuthSession();
  const { colors } = useTheme();
  const tabBarBottomPadding = Math.max(insets.bottom, 8);
  useTransactionSyncMonitor(currentUser?.accountId);

  if (isHydrating) {
    return null;
  }

  if (!currentUser) {
    return <Redirect href="/" />;
  }

  if (currentUser.profileTable === 'developer' && !currentUser.businessId) {
    return <Redirect href="/select-business" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 62 + tabBarBottomPadding,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surfaceElevated,
          paddingHorizontal: 12,
          paddingBottom: tabBarBottomPadding,
          paddingTop: 8,
        },
        tabBarItemStyle: {
          borderRadius: 18,
          marginHorizontal: 2,
        },
        tabBarActiveBackgroundColor: colors.primary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          title: "POS",
          tabBarIcon: ({ color, size }) => <Ionicons name="calculator-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: "Sales",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-box-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rent"
        options={{
          title: "Billing",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="file-document-edit-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="category"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="security"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
