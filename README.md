# Homiez

Homiez is a shared, neutral roommate ledger for expenses and chores. It records the facts, exposes the settlement math, and leaves actual money transfers outside the app.

## What is included

- Equal and custom expense splits in integer cents, including dollar-amount and percentage entry.
- Peer-by-peer settlement review plus creditor-authorized direct settlement, partial payments, corrections, and 30-day expense history.
- Settlement plans with external-payment confirmation; Homiez never calls a payment provider.
- Reusable chore templates, scheduling, completion/skip attribution, and a roommate-filtered rolling 30-day history.
- Household join codes, flat member permissions, move-out freezing, and initiator-only reclaiming.
- Supabase Auth with password recovery and secure account deletion, Row-Level Security policies, and Realtime subscriptions.

## Run the app

This project targets Expo SDK 54. Use Expo Go first:

```bash
bun install
bunx expo start
```

Open the QR code with Expo Go on iOS or Android. Supabase variables are required for account and household access.

## Connect Supabase

1. Create a Supabase project with Email/Password auth enabled.
2. Apply every migration in `supabase/migrations` in timestamp order (prefer `supabase db push` so migration history stays aligned).
3. Deploy `supabase/functions/delete-account` with JWT verification enabled. The service-role credential remains server-side in Supabase and must never be added to the app.
4. In Supabase Auth → URL Configuration, add `homiez://**` as an allowed Redirect URL so password-reset emails can reopen the app. Configure custom SMTP before production UAT; the built-in sender is rate-limited and best-effort.
5. Copy `.env.example` to `.env` and fill in the Project URL and **publishable** key. Never put a service-role or secret key in the app.
6. Restart Expo, create an account, then create or join a household.

The migrations create all household, expense, chore, settlement, and confirmation tables; enable RLS on every public table; expose only household-scoped records; publish the relevant tables for Realtime; and enforce safe household entry and exit rules. Sensitive membership and ledger-invariant operations use narrowly scoped RPCs.

## Verification

```bash
bunx tsc --noEmit
bunx expo lint
bunx expo export --platform web --output-dir <temporary-folder> --no-bytecode
```

The app is checked with TypeScript, Expo lint, peer-ledger invariant tests, and a static Expo web export.
