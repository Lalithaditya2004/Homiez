import type { PropsWithChildren } from 'react';
import { Image, type ImageSource } from 'expo-image';
import { View } from 'react-native';

import { useAppTheme } from '@/components/app-screen';

export const screenIllustrations = {
  ledger: require('@/assets/images/UI illustrations/Ledger.png'),
  chores: require('@/assets/images/UI illustrations/Chores_screen.png'),
  household: require('@/assets/images/UI illustrations/Household.png'),
  householdSetup: require('@/assets/images/UI illustrations/JoinorCreateHousehold.png'),
  account: require('@/assets/images/UI illustrations/Login.png'),
} satisfies Record<string, ImageSource>;

type ScreenIllustrationProps = PropsWithChildren<{
  source: ImageSource;
  backgroundColor?: string;
  artworkOnly?: boolean;
  showGround?: boolean;
}>;

export function ScreenIllustration({ artworkOnly = false, backgroundColor, children, showGround = true, source }: ScreenIllustrationProps) {
  const theme = useAppTheme();

  return (
    <View
      style={{
        marginHorizontal: -20,
        minHeight: artworkOnly ? 230 : 350,
        marginBottom: -54,
        overflow: showGround ? 'visible' : 'hidden',
        backgroundColor: backgroundColor ?? theme.background,
      }}>
      <Image
        accessible={false}
        source={source}
        style={{ position: 'absolute', left: 0, right: 0, top: artworkOnly ? 0 : undefined, bottom: artworkOnly ? undefined : 0, width: '100%', height: 230 }}
        contentFit="cover"
        contentPosition="center"
        transition={220}
      />
      {showGround ? (
        <View
          accessible={false}
          style={{
            position: 'absolute',
            left: -20,
            right: -20,
            top: 226,
            height: 7,
            backgroundColor: '#3B3839',
            borderTopWidth: 0,
            boxShadow: '0 -2px 8px rgba(0,0,0,.2)',
          }}
        />
      ) : null}
      {children ? <View style={{ paddingHorizontal: 20 }}>{children}</View> : null}
    </View>
  );
}
