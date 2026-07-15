import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { HouseholdProvider } from '@/providers/household-provider';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <HouseholdProvider>
        <Stack screenOptions={{ headerShadowVisible: false, headerBackButtonDisplayMode: 'minimal' }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-expense" options={{ presentation: 'formSheet', title: 'Add expense', sheetGrabberVisible: true }} />
          <Stack.Screen name="debt-detox" options={{ presentation: 'modal', title: 'Debt Detox' }} />
          <Stack.Screen name="add-chore" options={{ presentation: 'formSheet', title: 'New chore', sheetGrabberVisible: true }} />
          <Stack.Screen name="chore-history" options={{ presentation: 'modal', title: 'Chore history' }} />
          <Stack.Screen name="archived-roommates" options={{ presentation: 'modal', title: 'Archived roommates' }} />
          <Stack.Screen name="household-setup" options={{ presentation: 'formSheet', title: 'Set up household', sheetGrabberVisible: true }} />
          <Stack.Screen name="auth" options={{ presentation: 'modal', title: 'Account' }} />
        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </HouseholdProvider>
    </ThemeProvider>
  );
}
