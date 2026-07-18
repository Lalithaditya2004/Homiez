import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { BrandLockup } from '@/components/brand-mark';
import { PrimaryButton } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { useAccess } from '@/providers/access-provider';

type OnboardingPage = {
  eyebrow: string;
  title: string;
  description: string;
  image: ImageSource;
};

const pages: OnboardingPage[] = [
  {
    eyebrow: 'ONE SHARED LEDGER',
    title: 'See every split clearly.',
    description: 'Record shared expenses, understand who owes whom, and settle without losing the history behind the numbers.',
    image: require('@/assets/images/UI illustrations/Onboard ledger UI.png'),
  },
  {
    eyebrow: 'CHORES WITHOUT CHASING',
    title: 'Keep the home moving.',
    description: 'Assign, rotate, complete, and review chores together so the work stays visible without becoming noisy.',
    image: require('@/assets/images/UI illustrations/Onboard Chore UI.png'),
  },
  {
    eyebrow: 'PRIVATE BY DEFAULT',
    title: 'Enter through your own key.',
    description: 'Sign in securely, then create a household or join your roommates with one shared code.',
    image: require('@/assets/images/UI illustrations/Onboard signin UI.png'),
  },
];

export default function OnboardingScreen() {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const { completeOnboarding } = useAccess();
  const [pageIndex, setPageIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const page = pages[pageIndex];
  const isLast = pageIndex === pages.length - 1;
  const artworkHeight = Math.min(390, Math.max(270, width - 64));

  async function advance() {
    if (!isLast) {
      setPageIndex((current) => current + 1);
      return;
    }
    setFinishing(true);
    try {
      await completeOnboarding();
    } finally {
      setFinishing(false);
    }
  }

  return (
    <AppScreen key={`onboarding-${pageIndex}`} contentContainerStyle={{ minHeight: '100%', paddingTop: 24, paddingBottom: 28, justifyContent: 'space-between' }}>
      <View style={{ gap: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <BrandLockup compact />
          <Text selectable style={{ color: theme.faint, fontFamily: typography.bold, fontSize: 11 }}>
            {pageIndex + 1} / {pages.length}
          </Text>
        </View>

        <View style={{ overflow: 'hidden', height: artworkHeight, borderRadius: 30, borderCurve: 'continuous', backgroundColor: theme.card, boxShadow: '0 18px 42px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.035)' }}>
          <Image
            key={page.eyebrow}
            accessible
            accessibilityLabel={`${page.title} illustration`}
            source={page.image}
            contentFit="cover"
            contentPosition="center"
            transition={180}
            style={{ width: '100%', height: '100%' }}
          />
        </View>

        <View style={{ gap: 12 }}>
          <Text selectable style={{ color: theme.accent, fontFamily: typography.bold, fontSize: 11, letterSpacing: 0.8 }}>
            {page.eyebrow}
          </Text>
          <Text selectable style={{ color: theme.heading, fontFamily: typography.display, fontSize: 34, lineHeight: 39 }}>
            {page.title}
          </Text>
          <Text selectable style={{ color: theme.muted, fontFamily: typography.regular, fontSize: 14, lineHeight: 21 }}>
            {page.description}
          </Text>
        </View>
      </View>

      <View style={{ gap: 18, paddingTop: 24 }}>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', justifyContent: 'center', gap: 7 }}>
          {pages.map((item, index) => (
            <View
              key={item.eyebrow}
              accessibilityRole="tab"
              accessibilityState={{ selected: index === pageIndex }}
              style={{ width: index === pageIndex ? 24 : 7, height: 7, borderRadius: 999, backgroundColor: index === pageIndex ? theme.accent : theme.cardStrong }}
            />
          ))}
        </View>
        <PrimaryButton
          label={finishing ? 'Opening Homiez…' : isLast ? 'Sign in or create account' : 'Continue'}
          icon={isLast ? 'login' : 'arrow-forward'}
          disabled={finishing}
          onPress={() => void advance()}
        />
      </View>
    </AppScreen>
  );
}
