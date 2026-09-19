# Lagman House POS

Offline-first restaurant point of sale for Android, built with Expo (React Native, TypeScript), Expo Router,
Zustand, expo-sqlite and Supabase. Two roles (Admin, Cashier), Bluetooth ESC/POS receipt printing, and a
public QR web menu for customer self-ordering.

## Layout

```
app/                 Expo Router routes
  (auth)/            login, signup, verify-email
  (admin)/           dashboard, cashiers, menu, stock, templates, printer, history, qr, settings, account
  (cashier)/         menu + cart, cart review, customer-order queue, account, settings
  pending.tsx        locked screen for non-active cashiers
  phone/             link and verify a phone number
components/          UI kit (components/ui), sidebar, tab bar, indicators
features/            feature modules: auth, menu, stock, receipts, orders, printer, qr, sync, settings, notifications
lib/                 supabase client, sqlite (db.ts), i18n, types, formatting, storage
store/               zustand slices: auth, cart, language, printer, sync, customerOrders, toast
constants/theme.ts   design tokens
plugins/             Expo config plugin adding Bluetooth permissions
supabase/schema.sql  full Postgres schema, RLS, RPCs, triggers, seed data
web/                 static public menu page (QR ordering)
```

## Setup

1. Copy `.env.example` to `.env` and fill in the Supabase URL, publishable key and hosted menu URL.
2. Run `supabase/schema.sql` in the Supabase SQL Editor (see the report handed over with the build).
3. `npm install`
4. Build a development client (native Bluetooth module, so Expo Go cannot be used):

```
npm run build:dev          # eas build --profile development --platform android
```

Install the APK on the device, then:

```
npm start                  # expo start --dev-client
```

Other scripts: `npm run typecheck`, `npm run build:preview` (installable APK without dev client).

## Public menu

`web/` is a static site. Host it anywhere (see `web/README.md`) and set `EXPO_PUBLIC_PUBLIC_MENU_URL`
to its URL. The admin QR screen generates one QR per table pointing at `<URL>/?t=<TABLE_CODE>`.

## Key behaviours

- Every write goes to SQLite first and is flagged `is_dirty`; the sync engine pushes in the background and
  pulls server changes newer than the last synced `updated_at` per table.
- Stock is deducted locally on order completion and authoritatively on the server through
  `deduct_stock_for_order(order_id)`, which is idempotent. Orders flagged `is_test` never touch stock.
- Customer orders are claimed with `claim_customer_order(order_id, cashier_id)`, a single atomic UPDATE.
- Receipts are rendered by one function (`features/receipts/render.ts`) from an order plus a template
  config; the same function drives the printer and the on-screen preview.
- Language switches instantly through a string dictionary and per-component RTL layout, not `I18nManager`.
