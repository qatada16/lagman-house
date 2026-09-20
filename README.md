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
   The same three values live in each `eas.json` build profile's `env` block, which is what cloud builds use.
2. Run `supabase/schema.sql` in the Supabase SQL Editor, then every file in `supabase/migrations/` in numeric order.
   Both are safe to re-run.
3. In Supabase, Authentication -> URL Configuration -> Redirect URLs, add `lagmanhouse://**`.
   Email verification uses Supabase's default confirmation link, which deep-links back into the app.
4. `npm install`

## Accounts and tenants

- Every admin is a separate tenant. Menu, stock, receipt templates, settings, orders, expenses and
  customer orders are fully segregated; an admin never sees another admin's data, and neither do their cashiers.
- Cashiers choose their admin at signup and become part of that admin's tenant. Only that admin is notified,
  approves them, and sees their orders.
- Anyone can delete their own account from Account -> Delete account. Orders are kept for the records.
  If an admin deletes their account, their cashiers show as "No admin linked" and any admin can approve
  and claim them into their own tenant.

## Expenses and stock purchases

- Expenses (drawer -> Expenses) is a cash-flow ledger: outflows are negative, inflows positive, with
  categories, filters, charts, sortable table and CSV export.
- Recording a stock purchase (Stock -> item -> Record purchase) stores quantity and price, raises the
  quantity on hand, and optionally posts the cost to Expenses. Stock -> Purchase report shows spend by
  item and by month with CSV export.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Metro dev server for a development-client build |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run lint` | ESLint via `expo lint` |
| `npm run build:dev` | EAS cloud build: development client APK (needs `npm start` running to load JS) |
| `npm run build:preview` | EAS cloud build: standalone test APK, version not incremented |
| `npm run build:prod` | EAS cloud build: signed release APK, `versionCode` auto-incremented |
| `npm run build:aab` | EAS cloud build: release `.aab` for Google Play |
| `npm run build:local` | Release APK built on this machine (requires Android SDK and Java) |

Expo Go cannot run this app because of the native Bluetooth module; always use one of the builds above.

### First-time build

`build:dev` asks whether to generate an Android keystore. Answer yes; EAS stores it in your Expo account and
reuses it for every profile. When a build finishes, the EAS page shows a QR code and an Install button for the APK.

### Development workflow

```
npm run build:dev     # once, or whenever native dependencies change
npm start             # every session; open the installed dev client and connect
```

### Shipping

```
npm run build:prod    # release APK to install directly on the restaurant devices
npm run build:aab     # only if publishing through Google Play
```

Uninstall the development client before installing a release APK; both use the package `com.lagmanhouse.pos`.

## Public menu

`web/` is a static site. Host it anywhere (see `web/README.md`) and set `EXPO_PUBLIC_PUBLIC_MENU_URL`
to its URL. Each admin has a private menu code; the QR screen encodes `<URL>/?m=<code>`. Only that link
allows ordering, and every order is validated and priced on the server against that admin's menu.
Opening the URL without a code shows the admin marked as default, read-only. Regenerating the code
invalidates old QR prints. Customers type their table number as a hint.

## Key behaviours

- Every write goes to SQLite first and is flagged `is_dirty`; the sync engine pushes in the background and
  pulls server changes newer than the last synced `updated_at` per table.
- Stock is deducted locally on order completion and authoritatively on the server through
  `deduct_stock_for_order(order_id)`, which is idempotent. Orders flagged `is_test` never touch stock.
- Customer orders are claimed with `claim_customer_order(order_id, cashier_id)`, a single atomic UPDATE.
- Receipts are rendered by one function (`features/receipts/render.ts`) from an order plus a template
  config; the same function drives the printer and the on-screen preview. Templates choose printer font
  A or B and which sections print bold.
- History and analytics run on local SQLite data: any single date or range, cashier ranking, busiest hours,
  item-wise and cashier-wise sortable tables, revenue charts, and CSV export through the Android share sheet.
- Anonymous web visitors have no table access at all; they only call `public_menu`, `place_customer_order`
  and `customer_order_status`.
- Language switches instantly through a string dictionary and per-component RTL layout, not `I18nManager`.
