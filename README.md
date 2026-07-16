# Homiez

Homiez is a shared, neutral roommate ledger for expenses and chores. It records the facts, exposes the settlement math, and leaves actual money transfers outside the app.

## What is included

- Equal and custom expense splits in integer cents, including dollar-amount and percentage entry.
- Peer-by-peer settlement review with partial payments, corrections, and 30-day expense history.
- Settlement plans with external-payment confirmation; Homiez never calls a payment provider.
- Reusable chore templates, scheduling, completion/skip attribution, and a roommate-filtered rolling 30-day history.
- Household join codes, flat member permissions, move-out freezing, and initiator-only reclaiming.
- Supabase Auth, secure Row-Level Security policies, Realtime subscriptions, and a local demo fallback when cloud variables are absent.

## Run the app

This project targets Expo SDK 54. Use Expo Go first:

```bash
bun install
bunx expo start
```

Open the QR code with Expo Go on iOS or Android. Without Supabase variables, the app runs a persistent local demo household so every core flow can be explored.

## Connect Supabase

1. Create a Supabase project with Email/Password auth enabled.
2. Apply [the migration](supabase/migrations/20260714112216_initialize_homiez.sql) to that project.
3. Copy `.env.example` to `.env` and fill in the Project URL and **publishable** key. Never put a service-role or secret key in the app.
4. Restart Expo, create an account from Household → Account, then create or join a household.

The migration creates all household, expense, chore, settlement, and confirmation tables; enables RLS on every public table; exposes only household-scoped records; and publishes the relevant tables for Realtime. The sensitive membership and ledger-invariant operations use narrowly scoped RPCs.

## Verification

```bash
bunx tsc --noEmit
bunx expo lint
bunx expo export --platform web --output-dir <temporary-folder> --no-bytecode
```

The app is checked with TypeScript, Expo lint, peer-ledger invariant tests, and a static Expo web export.
