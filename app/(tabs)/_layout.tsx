import { Tabs } from 'expo-router';
import React from 'react';

import { useAppTheme } from '@/components/app-screen';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { typography } from '@/constants/design';

export default function TabLayout() {
  const theme = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.faint,
        tabBarLabelStyle: { fontFamily: typography.semibold, fontSize: 10, paddingTop: 2 },
        tabBarActiveBackgroundColor: theme.card,
        tabBarItemStyle: { borderRadius: 20, margin: 2, paddingVertical: 3 },
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 10,
          height: 72,
          paddingTop: 7,
          paddingBottom: 7,
          borderTopWidth: 0,
          borderRadius: 26,
          backgroundColor: theme.cardStrong,
          boxShadow: '0 16px 40px rgba(0,0,0,.44), inset 0 1px 0 rgba(255,255,255,.04)',
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: 'Ledger',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="list.bullet.rectangle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chores"
        options={{
          title: 'Chores',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="checklist" color={color} />,
        }}
      />
      <Tabs.Screen
        name="household"
        options={{
          title: 'Household',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="person.2.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
