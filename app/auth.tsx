import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Card, Pill, PrimaryButton } from '@/components/homiez-ui';
import { hasSupabaseConfig, supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const theme = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('Sign-in failed', error.message);
    else Alert.alert('Signed in', 'Your encrypted Supabase session is now stored on this device.');
  }

  async function signUp() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('Sign-up failed', error.message);
    else if (!data.session) Alert.alert('Check your inbox', 'Confirm your email, then return here to sign in.');
    else Alert.alert('Account created', 'You are signed in.');
  }

  return (
    <AppScreen keyboardShouldPersistTaps="handled">
      <View style={{ gap: 5 }}>
        <Pill tone={hasSupabaseConfig ? 'positive' : 'pending'}>{hasSupabaseConfig ? 'SUPABASE CONNECTED' : 'DEMO WORKSPACE'}</Pill>
        <Text selectable style={{ color: theme.heading, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Your account</Text>
        <Text selectable style={{ color: theme.muted, fontSize: 15 }}>Email/password authentication is managed by Supabase Auth.</Text>
      </View>

      {!hasSupabaseConfig ? (
        <Card accent={theme.pending}>
          <Text selectable style={{ color: theme.heading, fontSize: 17, fontWeight: '800' }}>Running in local demo mode</Text>
          <Text selectable style={{ color: theme.body, fontSize: 14, lineHeight: 20 }}>
            Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY from .env.example to enable real accounts, secure cloud data, and device-to-device updates.
          </Text>
        </Card>
      ) : (
        <Card>
          <View style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.body, fontSize: 14, fontWeight: '800' }}>EMAIL</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={theme.muted}
              value={email}
              onChangeText={setEmail}
              style={{ backgroundColor: theme.background, color: theme.heading, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, minHeight: 48, fontSize: 16 }}
            />
            <Text selectable style={{ color: theme.body, fontSize: 14, fontWeight: '800' }}>PASSWORD</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="password"
              secureTextEntry
              placeholder="At least 6 characters"
              placeholderTextColor={theme.muted}
              value={password}
              onChangeText={setPassword}
              style={{ backgroundColor: theme.background, color: theme.heading, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, minHeight: 48, fontSize: 16 }}
            />
          </View>
          <PrimaryButton label={loading ? 'Signing in…' : 'Sign in'} disabled={loading} onPress={() => void signIn()} />
          <PrimaryButton label={loading ? 'Working…' : 'Create account'} tone="chores" disabled={loading} onPress={() => void signUp()} />
        </Card>
      )}
    </AppScreen>
  );
}
