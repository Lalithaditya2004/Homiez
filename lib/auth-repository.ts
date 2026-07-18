import * as Linking from 'expo-linking';

import { supabase } from '@/lib/supabase';

function clientOrThrow() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export function passwordResetRedirectUrl(): string {
  return Linking.createURL('/reset-password');
}

export async function sendPasswordResetEmail(email: string): Promise<void> {
  const cleanEmail = email.trim();
  if (!cleanEmail) throw new Error('Enter your email address.');
  const { error } = await clientOrThrow().auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: passwordResetRedirectUrl(),
  });
  if (error) throw new Error(error.message);
}

export async function recoverSessionFromUrl(url: string): Promise<void> {
  const client = clientOrThrow();
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  const hash = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash);
  hash.forEach((value, key) => params.set(key, value));

  const authError = params.get('error_description') ?? params.get('error');
  if (authError) throw new Error(authError);

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw new Error(error.message);
    return;
  }

  const code = params.get('code');
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw new Error(error.message);
    return;
  }

  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error('This password-reset link is invalid or has expired.');
}

export async function updatePassword(password: string): Promise<void> {
  if (password.length < 8) throw new Error('Use at least 8 characters.');
  const { error } = await clientOrThrow().auth.updateUser({ password });
  if (error) throw new Error(error.message);
}
