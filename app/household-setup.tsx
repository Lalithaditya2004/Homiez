import { router } from "expo-router";
import { useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";

import { AppScreen, useAppTheme } from "@/components/app-screen";
import {
  Callout,
  Card,
  EditorialHeader,
  Pill,
  PrimaryButton,
  Segmented,
} from "@/components/homiez-ui";
import {
  ScreenIllustration,
  screenIllustrations,
} from "@/components/screen-illustration";
import { typography } from "@/constants/design";
import { hasSupabaseConfig } from "@/lib/supabase";
import { useHousehold } from "@/providers/household-provider";

export default function HouseholdSetupScreen() {
  const theme = useAppTheme();
  const { createCloudHousehold, joinCloudHousehold } = useHousehold();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit() {
    const value = mode === "create" ? name.trim() : joinCode.trim();
    if (!value)
      return Alert.alert(
        mode === "create"
          ? "Name your household first."
          : "Enter the household join code.",
      );
    setLoading(true);
    try {
      if (mode === "create") await createCloudHousehold(value);
      else await joinCloudHousehold(value);
      router.replace("/household" as never);
    } catch (error) {
      Alert.alert(
        mode === "create"
          ? "Could not create household"
          : "Could not join household",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }
  const field = {
    backgroundColor: theme.background,
    color: theme.heading,
    borderRadius: 19,
    paddingHorizontal: 16,
    minHeight: 58,
    fontFamily: typography.medium,
    fontSize: 15,
    boxShadow: "inset 4px 4px 11px rgba(0,0,0,.27)",
  } as const;
  return (
    <AppScreen keyboardShouldPersistTaps="handled">
      <ScreenIllustration source={screenIllustrations.householdSetup} artworkOnly />
      <Card accent={theme.accent} variant="elevated">
        <EditorialHeader
          eyebrow="One flat, one ledger"
          title="Find your flat"
          description="Create the household from scratch or use the key another roommate shared."
        />
        <View style={{ height: 1, backgroundColor: theme.border }} />
        <Segmented
          value={mode}
          onChange={(value) => setMode(value as typeof mode)}
          options={[
            { value: "create", label: "Create new" },
            { value: "join", label: "Join existing" },
          ]}
        />
        {mode === "create" ? (
          <>
            <Pill tone="pending">START FRESH</Pill>
            <Text
              selectable
              style={{
                color: theme.heading,
                fontFamily: typography.semibold,
                fontSize: 20,
              }}
            >
              Create a household
            </Text>
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: theme.muted,
                  fontFamily: typography.semibold,
                  fontSize: 11,
                }}
              >
                HOUSEHOLD NAME
              </Text>
              <TextInput
                accessibilityLabel="Household name"
                value={name}
                onChangeText={setName}
                placeholder="The Cedar Flat"
                placeholderTextColor={theme.faint}
                style={field}
              />
            </View>
            <Text
              selectable
              style={{ color: theme.muted, fontSize: 11, lineHeight: 17 }}
            >
              Homiez creates a unique join code every active roommate can share.
            </Text>
            <PrimaryButton
              label={loading ? "Creating…" : "Create household"}
              icon="home"
              disabled={loading || !hasSupabaseConfig}
              onPress={() => void submit()}
            />
          </>
        ) : (
          <>
            <Pill tone="subtle">USE A KEY</Pill>
            <Text
              selectable
              style={{
                color: theme.heading,
                fontFamily: typography.semibold,
                fontSize: 20,
              }}
            >
              Join an existing household
            </Text>
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  color: theme.muted,
                  fontFamily: typography.semibold,
                  fontSize: 11,
                }}
              >
                JOIN CODE
              </Text>
              <TextInput
                accessibilityLabel="Join code"
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="CEDAR-42"
                placeholderTextColor={theme.faint}
                autoCapitalize="characters"
                style={[
                  field,
                  { fontFamily: typography.extraBold, letterSpacing: 2 },
                ]}
              />
            </View>
            <Text
              selectable
              style={{ color: theme.muted, fontSize: 11, lineHeight: 17 }}
            >
              Enter the code shared by an active roommate to join their existing
              ledger.
            </Text>
            <PrimaryButton
              label={loading ? "Joining…" : "Join household"}
              icon="key"
              disabled={loading || !hasSupabaseConfig}
              onPress={() => void submit()}
            />
          </>
        )}
      </Card>
      {!hasSupabaseConfig ? (
        <Callout title="Cloud setup required">
          Add the two EXPO_PUBLIC_SUPABASE values from .env.example to create or
          join a live household. The local demo remains available.
        </Callout>
      ) : null}
    </AppScreen>
  );
}
