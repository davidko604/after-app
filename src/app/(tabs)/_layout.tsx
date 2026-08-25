import { Tabs } from 'expo-router';
import { type ColorValue, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette } from '@/constants/theme';

type TabIconProps = {
  color: ColorValue;
  glyph: string;
};

function TabIcon({ color, glyph }: TabIconProps) {
  return <Text style={[styles.icon, { color }]}>{glyph}</Text>;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.forest,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 58 + insets.bottom,
            paddingBottom: Math.max(8, insets.bottom),
          },
        ],
      }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarAccessibilityLabel: 'Today timeline tab',
          tabBarIcon: ({ color }) => <TabIcon color={color} glyph="●" />,
          title: 'Today',
        }}
      />
      <Tabs.Screen
        name="patterns"
        options={{
          tabBarAccessibilityLabel: 'Patterns tab',
          tabBarIcon: ({ color }) => <TabIcon color={color} glyph="≈" />,
          title: 'Patterns',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarAccessibilityLabel: 'Settings and demo tab',
          tabBarIcon: ({ color }) => <TabIcon color={color} glyph="•••" />,
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    backgroundColor: palette.card,
    borderTopColor: palette.border,
    paddingTop: 6,
  },
});
