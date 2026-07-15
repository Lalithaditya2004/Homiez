import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';

import { AppScreen, useAppTheme } from '@/components/app-screen';
import { Card, PrimaryButton } from '@/components/homiez-ui';
import { hasSupabaseConfig } from '@/lib/supabase';
import { useHousehold } from '@/providers/household-provider';

export default function HouseholdSetupScreen() {
  const theme = useAppTheme();
  const { createCloudHousehold, joinCloudHousehold } = useHousehold();
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState<'create' | 'join' | null>(null);

  async function createHousehold() {
    if (!name.trim()) {
      Alert.alert('Name your household first.');
      return;
    }
    setLoading('create');
    try {
      await createCloudHousehold(name);
      router.replace('/household' as never);
    } catch (error) {
      Alert.alert('Could not create household', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(null);
    }
  }

  async function joinHousehold() {
    if (!joinCode.trim()) {
      Alert.alert('Enter the household join code.');
      return;
    }
    setLoading('join');
    try {
      await joinCloudHousehold(joinCode);
      router.replace('/household' as never);
    } catch (error) {
      Alert.alert('Could not join household', error instanceof Error ? error.message : 'Please check the code and try again.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <AppScreen keyboardShouldPersistTaps="handled">
      <View style={{ gap: 4 }}>
        <Text selectable style={{ color: theme.heading, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Find your flat</Text>
        <Text selectable style={{ color: theme.muted, fontSize: 15 }}>Create a household or join one with its shareable code.</Text>
      </View>

      {!hasSupabaseConfig ? (
        <Card accent={theme.pending}>
          <Text selectable style={{ color: theme.heading, fontSize: 17, fontWeight: '800' }}>Connect Supabase first</Text>
          <Text selectable style={{ color: theme.body, fontSize: 14, lineHeight: 20 }}>Add the two EXPO_PUBLIC_SUPABASE variables in .env to enable secure cloud households.</Text>
        </Card>
      ) : (
        <>
          <Card>
            <Text selectable style={{ color: theme.heading, fontSize: 18, fontWeight: '800' }}>Create a household</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. The Cedar Flat"
              placeholderTextColor={theme.muted}
              style={{ backgroundColor: theme.background, color: theme.heading, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, minHeight: 48, fontSize: 16 }}
            />
            <Text selectable style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>Homiez creates a unique join code. Every active roommate can then share it.</Text>
            <PrimaryButton label={loading === 'create' ? 'Creating…' : 'Create household'} disabled={loading !== null} onPress={() => void createHousehold()} />
          </Card>

          <Card accent={theme.chores}>
            <Text selectable style={{ color: theme.heading, fontSize: 18, fontWeight: '800' }}>Join an existing household</Text>
            <TextInput
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="e.g. CEDAR-42"
              placeholderTextColor={theme.muted}
              autoCapitalize="characters"
              style={{ backgroundColor: theme.background, color: theme.heading, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 12, minHeight: 48, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 }}
            />
            <PrimaryButton label={loading === 'join' ? 'Joining…' : 'Join household'} tone="chores" disabled={loading !== null} onPress={() => void joinHousehold()} />
          </Card>
        </>
      )}
    </AppScreen>
  );
}
