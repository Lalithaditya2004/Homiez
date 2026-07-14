import type { PropsWithChildren } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

import { themeFor } from '@/constants/design';
import { useColorScheme } from '@/hooks/use-color-scheme';

type AppScreenProps = PropsWithChildren<ScrollViewProps>;

export function useAppTheme() {
  return themeFor(useColorScheme());
}

export function AppScreen({ children, contentContainerStyle, ...props }: AppScreenProps) {
  const theme = useAppTheme();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={[{ padding: 16, paddingBottom: 40, gap: 16 }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      {...props}>
      {children}
    </ScrollView>
  );
}
