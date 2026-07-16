import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/components/app-screen';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { typography } from '@/constants/design';

export default function TabLayout() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.faint,
        tabBarLabelStyle: { fontFamily: typography.semibold, fontSize: 10, paddingTop: 1 },
        tabBarActiveBackgroundColor: 'transparent',
        tabBarItemStyle: { borderRadius: 20, borderCurve: 'continuous', overflow: 'hidden', marginHorizontal: 4, marginVertical: 2, paddingVertical: 3 },
        tabBarStyle: {
          height: 68 + bottomPadding,
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: bottomPadding,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          backgroundColor: theme.card,
          boxShadow: '0 -12px 30px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.025)',
        },
        tabBarHideOnKeyboard: true,
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
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} name="list.bullet.rectangle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chores"
        options={{
          title: 'Chores',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} name="checklist" color={color} />,
        }}
      />
      <Tabs.Screen
        name="household"
        options={{
          title: 'Household',
          tabBarIcon: ({ color, focused }) => <TabIcon focused={focused} name="person.2.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ color, focused, name }: { color: string; focused: boolean; name: React.ComponentProps<typeof IconSymbol>['name'] }) {
  const theme = useAppTheme();
  return (
    <View style={{ width: 48, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderCurve: 'continuous', backgroundColor: focused ? theme.cardStrong : 'transparent', boxShadow: focused ? 'inset 0 1px 0 rgba(255,255,255,.045), 0 5px 12px rgba(0,0,0,.2)' : undefined }}>
      <IconSymbol size={23} name={name} color={color} />
    </View>
  );
}
