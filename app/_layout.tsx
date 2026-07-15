import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { themeFor, typography } from '@/constants/design';
import { HouseholdProvider } from '@/providers/household-provider';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = themeFor(colorScheme);
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const canRender = process.env.EXPO_OS === 'web' || fontsLoaded || fontError;
  const baseTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.muted,
      background: colors.background,
      card: colors.card,
      text: colors.heading,
      border: colors.border,
      notification: colors.accent,
    },
  };

  useEffect(() => {
    if (canRender) void SplashScreen.hideAsync();
  }, [canRender]);

  if (!canRender) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <HouseholdProvider>
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.heading,
            headerTitleStyle: { color: colors.heading, fontFamily: typography.bold, fontSize: 15 },
            contentStyle: { backgroundColor: colors.background },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-expense" options={{ presentation: 'formSheet', title: 'Add expense', sheetGrabberVisible: true }} />
          <Stack.Screen name="debt-detox" options={{ presentation: 'modal', title: 'Debt Detox' }} />
          <Stack.Screen name="add-chore" options={{ presentation: 'formSheet', title: 'New chore', sheetGrabberVisible: true }} />
          <Stack.Screen name="chore-history" options={{ presentation: 'modal', title: 'Chore history' }} />
          <Stack.Screen name="archived-roommates" options={{ presentation: 'modal', title: 'Archived roommates' }} />
          <Stack.Screen name="household-setup" options={{ presentation: 'formSheet', title: 'Set up household', sheetGrabberVisible: true }} />
          <Stack.Screen name="auth" options={{ presentation: 'modal', title: 'Account' }} />
        </Stack>
        <StatusBar style="light" backgroundColor={colors.background} />
      </HouseholdProvider>
    </ThemeProvider>
  );
}
