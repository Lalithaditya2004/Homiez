import type { PropsWithChildren } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

import { themeFor } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AppScreenProps = PropsWithChildren<ScrollViewProps>;

export function useAppTheme() {
  return themeFor(useColorScheme());
}

export function AppScreen({ children, contentContainerStyle, style, ...props }: AppScreenProps) {
  const theme = useAppTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[{ flex: 1, backgroundColor: theme.background }, style]}
      contentContainerStyle={[{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 48, gap: 22 }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      {...props}>
      {children}
    </ScrollView>
  );
}
