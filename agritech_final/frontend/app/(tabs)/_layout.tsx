import { Tabs } from "expo-router";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { colors } from "@/src/theme";
import { useI18n } from "@/src/i18n";

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("home"),
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="crops"
        options={{
          title: t("crops"),
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="sprout" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="compare"
        options={{
          title: t("compare"),
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="compare-horizontal" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("settings"),
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
