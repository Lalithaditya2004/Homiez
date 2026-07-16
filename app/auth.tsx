import { useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";

import { AppScreen, useAppTheme } from "@/components/app-screen";
import { BrandLockup } from "@/components/brand-mark";
import {
  Callout,
  Card,
  EditorialHeader,
  Pill,
  PrimaryButton,
} from "@/components/homiez-ui";
import {
  ScreenIllustration,
  screenIllustrations,
} from "@/components/screen-illustration";
import { typography } from "@/constants/design";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export default function AuthScreen() {
  const theme = useAppTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  async function signIn() {
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    Alert.alert(
      error ? "Sign-in failed" : "Signed in",
      error?.message ??
        "Your encrypted Supabase session is now stored on this device.",
    );
  }
  async function signUp() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) Alert.alert("Sign-up failed", error.message);
    else
      Alert.alert(
        data.session ? "Account created" : "Check your inbox",
        data.session
          ? "You are signed in."
          : "Confirm your email, then return here to sign in.",
      );
  }
  const field = {
    backgroundColor: theme.card,
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
      <ScreenIllustration source={screenIllustrations.account} artworkOnly />
      <Card accent={theme.accent} variant="elevated">
        <EditorialHeader
          eyebrow="Your private key"
          title="Your account"
          description="Email identity connects this device to the shared household without changing the flat hierarchy."
        />
        <View style={{ height: 1, backgroundColor: theme.border }} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <BrandLockup compact />
          <Pill tone={hasSupabaseConfig ? "positive" : "neutral"}>
            {hasSupabaseConfig ? "SUPABASE CONNECTED" : "DEMO WORKSPACE"}
          </Pill>
        </View>
        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: theme.muted,
              fontFamily: typography.semibold,
              fontSize: 11,
            }}
          >
            EMAIL
          </Text>
          <TextInput
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={theme.faint}
            style={field}
          />
        </View>
        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: theme.muted,
              fontFamily: typography.semibold,
              fontSize: 11,
            }}
          >
            PASSWORD
          </Text>
          <TextInput
            accessibilityLabel="Password"
            autoCapitalize="none"
            autoComplete="password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={theme.faint}
            style={field}
          />
        </View>
        <PrimaryButton
          label={loading ? "Signing in…" : "Sign in"}
          icon="login"
          disabled={loading || !hasSupabaseConfig}
          onPress={() => void signIn()}
        />
        <PrimaryButton
          label={loading ? "Working…" : "Create account"}
          tone="dark"
          icon="person-add"
          disabled={loading || !hasSupabaseConfig}
          onPress={() => void signUp()}
        />
      </Card>
      {!hasSupabaseConfig ? (
        <Callout title="Private to this device, for now.">
          Add the Supabase values from .env.example to enable real accounts and
          secure device-to-device updates.
        </Callout>
      ) : (
        <Callout title="Private by default">
          Your encrypted Supabase session stays on this device and can be
          revoked at any time.
        </Callout>
      )}
    </AppScreen>
  );
}
