import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Card, EditorialHeader, PrimaryButton } from '@/components/homiez-ui';
import { typography } from '@/constants/design';
import { sendPasswordResetEmail } from '@/lib/auth-repository';

export default function ForgotPasswordScreen() {
  const theme = useAppTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendReset() {
    setLoading(true);
    try {
      await sendPasswordResetEmail(email);
      Alert.alert('Check your inbox', 'If an account exists for that email, a secure password-reset link is on its way.');
    } catch (error) {
      Alert.alert('Could not send reset email', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppScreen keyboardShouldPersistTaps="handled" contentContainerStyle={{ minHeight: '100%', justifyContent: 'center' }}>
      <Card accent={theme.accent} variant="elevated">
        <EditorialHeader eyebrow="Account recovery" title="Forgot password" description="We will email a one-time link that opens Homiez so you can choose a new password." />
        <View style={{ height: 1, backgroundColor: theme.border }} />
        <Text style={{ color: theme.muted, fontFamily: typography.semibold, fontSize: 11 }}>EMAIL</Text>
        <TextInput
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={theme.faint}
          style={{ minHeight: 58, paddingHorizontal: 16, borderRadius: 19, backgroundColor: theme.card, color: theme.heading, fontFamily: typography.medium, fontSize: 15, boxShadow: 'inset 4px 4px 11px rgba(0,0,0,.27)' }}
        />
        <PrimaryButton label={loading ? 'Sending…' : 'Send reset link'} icon="mail-outline" disabled={loading || !email.trim()} onPress={() => void sendReset()} />
        <Pressable accessibilityRole="button" onPress={() => router.replace('/auth' as never)} style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Text style={{ color: theme.muted, fontFamily: typography.semibold }}>Back to sign in</Text>
        </Pressable>
      </Card>
    </AppScreen>
  );
}
