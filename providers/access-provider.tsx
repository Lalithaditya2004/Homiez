import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

const ONBOARDING_KEY = 'homiez-onboarding-v1';

type AccessContextValue = {
  hasCompletedOnboarding: boolean;
  isOnboardingReady: boolean;
  completeOnboarding: () => Promise<void>;
};

const AccessContext = createContext<AccessContextValue | null>(null);

export function AccessProvider({ children }: React.PropsWithChildren) {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isOnboardingReady, setIsOnboardingReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => setHasCompletedOnboarding(value === 'complete'))
      .catch(() => setHasCompletedOnboarding(false))
      .finally(() => setIsOnboardingReady(true));
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'complete');
    setHasCompletedOnboarding(true);
  }, []);

  const value = useMemo(
    () => ({ hasCompletedOnboarding, isOnboardingReady, completeOnboarding }),
    [completeOnboarding, hasCompletedOnboarding, isOnboardingReady],
  );

  return <AccessContext value={value}>{children}</AccessContext>;
}

export function useAccess(): AccessContextValue {
  const value = React.use(AccessContext);
  if (!value) throw new Error('useAccess must be used within AccessProvider.');
  return value;
}
