import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Card, EditorialHeader, PrimaryButton } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { recoverSessionFromUrl, updatePassword } from '@/lib/auth-repository';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const theme = useAppTheme();
  const incomingUrl = Linking.useURL();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && active) setReady(true);
    });
    void (async () => {
      try {
        if (incomingUrl) await recoverSessionFromUrl(incomingUrl);
        else {
          const session = await supabase?.auth.getSession();
          if (!session?.data.session) throw new Error('Open the password-reset link from your email.');
        }
        if (active) setReady(true);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'This reset link could not be opened.');
      }
    })();
    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, [incomingUrl]);

  async function savePassword() {
    if (password !== confirmPassword) return Alert.alert('Passwords do not match.');
    setLoading(true);
    try {
      await updatePassword(password);
      Alert.alert('Password updated', 'You can now continue using your account.', [
        { text: 'Continue', onPress: () => router.replace('/' as never) },
      ]);
    } catch (caught) {
      Alert.alert('Could not update password', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const field = { minHeight: 58, paddingHorizontal: 16, borderRadius: 19, backgroundColor: theme.card, color: theme.heading, fontFamily: typography.medium, fontSize: 15, boxShadow: 'inset 4px 4px 11px rgba(0,0,0,.27)' } as const;
  return (
    <AppScreen keyboardShouldPersistTaps="handled" contentContainerStyle={{ minHeight: '100%', justifyContent: 'center' }}>
      <Card accent={theme.accent} variant="elevated">
        <EditorialHeader eyebrow="Account recovery" title="Choose a new password" description={error ?? (ready ? 'Use at least 8 characters and avoid reusing a password from another app.' : 'Validating your secure reset link…')} />
        <View style={{ height: 1, backgroundColor: theme.border }} />
        {ready && !error ? (
          <>
            <Text style={{ color: theme.muted, fontFamily: typography.semibold, fontSize: 11 }}>NEW PASSWORD</Text>
            <TextInput accessibilityLabel="New password" autoComplete="new-password" secureTextEntry value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor={theme.faint} style={field} />
            <Text style={{ color: theme.muted, fontFamily: typography.semibold, fontSize: 11 }}>CONFIRM PASSWORD</Text>
            <TextInput accessibilityLabel="Confirm password" autoComplete="new-password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat password" placeholderTextColor={theme.faint} style={field} />
            <PrimaryButton label={loading ? 'Updating…' : 'Update password'} icon="lock-reset" disabled={loading || password.length < 8 || !confirmPassword} onPress={() => void savePassword()} />
          </>
        ) : null}
        {error ? <PrimaryButton label="Request another link" icon="mail-outline" onPress={() => router.replace('/forgot-password' as never)} /> : null}
      </Card>
    </AppScreen>
  );
}
