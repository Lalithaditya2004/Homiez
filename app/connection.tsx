import { Text, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { BrandMark } from '@/components/brand-mark';
import { Card, EditorialHeader, PrimaryButton } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { supabase } from '@/lib/supabase';
import { useHousehold } from '@/providers/household-provider';

export default function ConnectionScreen() {
  const theme = useAppTheme();
  const { cloudError, refreshCloud } = useHousehold();

  return (
    <AppScreen contentContainerStyle={{ minHeight: '100%', justifyContent: 'center' }}>
      <Card accent={theme.accent} variant="elevated">
        <EditorialHeader
          eyebrow="Connection check"
          title="The shared home is out of reach."
          description="Your private screens stay locked until the household can be verified."
        />
        <View style={{ height: 1, backgroundColor: theme.border }} />
        <BrandMark />
        <Text selectable style={{ color: theme.muted, fontFamily: typography.regular, fontSize: 14, lineHeight: 21 }}>
          {cloudError ?? 'Check your connection and try again.'}
        </Text>
        <PrimaryButton label="Try again" icon="refresh" onPress={() => void refreshCloud()} />
        <PrimaryButton label="Sign out" tone="dark" icon="logout" onPress={() => void supabase?.auth.signOut()} />
      </Card>
    </AppScreen>
  );
}
