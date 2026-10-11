# Lagman House POS

Offline-first restaurant point of sale for Android, built with Expo (React Native, TypeScript), Expo Router,
Zustand, expo-sqlite and Supabase. Two roles (Admin, Cashier), Bluetooth ESC/POS receipt printing, and a
public QR web menu for customer self-ordering.

## Layout

```
app/                 Expo Router routes
  (auth)/            login, signup, verify-email, forgot-password
  auth/              email link landings: callback (signup), reset (choose a new password)
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
supabase/migrations/ incremental migrations, run in numeric order after schema.sql
supabase/functions/  eas-build-webhook Edge Function that publishes release builds
web/                 static public menu page (QR ordering)
```

## Setup

1. Copy `.env.example` to `.env` and fill in the Supabase URL, publishable key and hosted menu URL.
   The same three values live in each `eas.json` build profile's `env` block, which is what cloud builds use.
2. Run `supabase/schema.sql` in the Supabase SQL Editor, then every file in `supabase/migrations/` in numeric order
   (004 adds promotions, 005 locks down app releases for the update prompt, 006 adds order editing and cancelling).
   Both are safe to re-run. A migration that adds columns to synced tables must go live together with the app build
   that uses them; see "Rolling out a migration" below.
3. In Supabase, Authentication -> URL Configuration -> Redirect URLs, add `lagmanhouse://**`.
   Email verification and password reset use Supabase's default email links, which deep-link back into the app.
4. `npm install`. A `postinstall` step runs `patch-package`, which applies the fixes in `patches/` to the
   Bluetooth printer library (extra connection fallbacks, chunked sends, device class for printer detection).
   EAS builds run the same step, so never delete the `patches/` folder.

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

## Promotions

- **Deals** (drawer -> Promotions -> Deals): a fixed-price combo made of "included items". Each included item
  lists the menu items the customer may choose from, optionally pinned to one size; the first choice is
  preselected. At checkout the cashier (or the customer on the web menu) picks the options in a sheet. A deal is
  stored as one priced line plus one zero-priced line per component carrying the real menu item and size, so
  stock deduction and item statistics count every component.
- **Discounts**: a percent or fixed amount off selected menu items, with an optional date window. Applied
  automatically in the cashier grid, the admin menu list, the public web menu and the server-side pricing of
  customer orders. Original prices are shown struck through. The best discount wins; they do not stack.
- **Coupons**: codes with percent or fixed value, optional minimum order, maximum discount, usage cap and date
  window. Cashiers see the active codes on the checkout screen and can also type one. Usage is counted by a
  database trigger, so a cap cannot be exceeded by two cashiers at once.
- Receipt templates have "Show total saved" and "Show coupon line" toggles.

## Editing and cancelling orders

- Cashiers: Orders tab. Admins: drawer -> Recent orders, or tap an order in History. The list shows the last 24 hours;
  cashiers see their own orders, admins see every order of their restaurant.
- Tap an order -> **Edit order** opens the menu with the order's items: change quantities, remove lines or add items
  (new items use today's price and discounts, existing lines keep the price they were sold at). Review changes shows
  the previous and new total and how much to collect or refund, then Save changes. Print the revised receipt from there;
  it is marked REVISED RECEIPT.
- **Cancel order** needs a reason. The order stays in the records as Cancelled with who cancelled it, when and why;
  a reprint is marked CANCELLED.
- What updates automatically: revenue, charts, item and cashier tables (only completed orders count), stock (an edit
  returns or takes exactly the difference, a cancel returns everything), coupon uses (released on cancel or when the
  coupon is removed or no longer reaches its minimum). Test orders never touch stock or coupons.
- Audit: the server records the original total, edit count, who edited or cancelled and when; clients cannot forge
  these. When a cashier edits or cancels an order the admin gets a push notification. History shows a Cancelled tile
  (count and value) and a "Show cancelled orders" switch, and the CSV export includes status, original total, edits
  and cancel reason.
- Orders older than 24 hours are locked in the app. Cancelled orders cannot be reopened.
- Works offline like everything else: the change is saved locally and synced later. If two devices edit the same order
  before syncing, the last one to sync wins as a whole; items are never mixed.
- The editor uses its own cart, separate from the POS cart, so a sale in progress is never touched. Claiming a QR
  order works the same way.

### Rolling out a migration

1. `npm run build:prod -- --message "[mandatory] What changed"` and wait until the build finishes (the webhook
   publishes it, so every device shows a non-dismissable update dialog on its next launch).
2. Run the new migration in the SQL Editor.
3. Open the app on each device and install the update.

Between steps 2 and 3, devices on the old build cannot sync (they keep their sales locally and upload them after
updating), so do step 3 straight away. From 1.0.2 builds made after migration 006, the app ignores server columns it
does not know yet, so adding columns no longer stops older builds from downloading.

## Forgot password

1. Login -> "Forgot password?" -> enter the account email -> Send reset link.
2. Open the email **on the phone that has the app** and tap the link. It opens the app on "Choose a new password".
3. Save the new password. The user is signed in, and every other device signed in to that account is signed out.

- The link works once and expires after one hour. An old or used link shows "Link not valid" with a button to send a new one.
- The confirmation is generic ("if an account exists"), so the screen never reveals which emails are registered.
- Supabase's built-in mailer is rate-limited (a few emails per hour per project, one request per minute per address).
  The app shows a countdown when Supabase asks to wait.
- If another account is signed in when the link is opened, the app asks before logging it out.
- Signed-in users can still change their password from Account -> Password.

## App updates

On every launch, and when the app returns to the foreground after 30 minutes, the app calls `latest_release()`.
If a newer version, or the same version with a higher build number, exists, a dialog offers **Download**. It opens
the Expo APK link in the browser. When the file finishes, tap it and choose Update. Data is kept because every
build is signed with the same EAS keystore. "Later" hides the dialog for 6 hours. A mandatory release has no Later button.

Only the owner can publish releases: the table has no client write access (migration 005). Releases are
published automatically by an EAS build webhook.

### One-time setup

1. Run `supabase/migrations/005_releases.sql`.
2. Generate a secret (at least 16 characters):
   `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
3. Supabase Dashboard -> Edge Functions -> Secrets: add `EAS_WEBHOOK_SECRET` with that value.
4. Deploy `supabase/functions/eas-build-webhook/index.ts` as a function named `eas-build-webhook`, either way:
   - Dashboard -> Edge Functions -> Deploy a new function -> Via Editor: paste the file, deploy, then open the
     function's Details and turn **off** "Verify JWT with legacy secret" / "Enforce JWT verification" (EAS cannot send one).
   - Or CLI: `npx supabase login`, then
     `npx supabase functions deploy eas-build-webhook --project-ref klnsekmdkadwqnrlumww --no-verify-jwt`
     (add `--use-api` if Docker is not installed).
5. Register the webhook with EAS, using the same secret:
   `eas webhook:create --event BUILD --url https://klnsekmdkadwqnrlumww.supabase.co/functions/v1/eas-build-webhook --secret <secret>`

### Every release

1. Raise `version` in `app.json` (and `package.json`). EAS raises the build number itself.
2. `npm run build:prod -- --message "What changed"`. The message becomes the "What is new" text.
   Put `[mandatory]` anywhere in the message to force the update, for example `--message "[mandatory] Printer fix"`.
3. When the build finishes, the webhook adds the release. Check it with `select * from app_releases order by released_at desc;`.

Only finished Android `production` APK builds are published; `preview`, `development` and `.aab` builds are ignored.
Set the function secret `EAS_RELEASE_PROFILE` to publish a different profile.

Manual fallback (or to change a release later):

```sql
insert into public.app_releases (version, build_number, apk_url, notes, mandatory)
values ('1.0.3', 12, 'https://expo.dev/artifacts/eas/....apk', 'What changed', false);

update public.app_releases set mandatory = true where version = '1.0.3';
```

Notes:
- Expo deletes build artifacts after their retention period. The dialog stops offering a release whose
  `expires_at` has passed, so publish a fresh build if devices have not updated by then.
- Devices still on 1.0.1 never show the dialog, because the prompt was not mounted in that build. Install 1.0.2 on
  them once by hand; every later version updates through the dialog.
- A development client compares its own installed version. It shows the dialog when a newer production build exists;
  tap Later, because installing the release replaces the development client.

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

### Distribution, Play Protect and iOS

- Test Play Protect behaviour with `npm run build:prod`, never the development client. Dev builds are
  debuggable, which Play Protect treats as higher risk.
- The manifest only requests what the app uses: Bluetooth, network, notifications and the background sync
  wakeups. Microphone, camera, overlay and storage permissions are blocked in `app.json`, and Android backup
  is disabled so local orders and the session are never copied to a cloud backup.
- A sideloaded APK signed by a new key has no reputation, so Play Protect may still warn on first install.
  The lasting fix is distributing through Google Play (an internal testing track is enough), or submitting
  the APK to Google for Play Protect review.
- iOS is not a build target. Budget thermal printers use Bluetooth Classic, which iOS does not allow third-party
  apps to use, and installing on iPhones needs an Apple Developer account.

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
  `deduct_stock_for_order(order_id)`. It reconciles the order's current items against what was already taken for it
  (table `order_stock_applied`), so creating, editing and cancelling all converge and repeated calls change nothing.
  Every stock change is logged in `stock_movements` (`order` / `order_return`). Orders flagged `is_test` never touch stock.
- An edit gives the order a new `revision_id` and a fresh set of items with that revision; the order's items are the
  ones matching its revision. Older item rows stay for the record and are ignored everywhere.
- Customer orders are claimed with `claim_customer_order(order_id, cashier_id)`, a single atomic UPDATE.
- Receipts are laid out by `features/receipts/render.ts` into exact fixed-width lines, sent to the printer
  as raw ESC/POS bytes with no margin, and shown line for line in the template preview. Columns size
  themselves to their content; long names wrap inside the Item column and overflowing numbers continue on the
  next row under their own column. Templates pick Large (Font A), Medium (compact font at double height) or
  Small (compact font), an optional characters-per-line override, bold sections and the "x2" quantity style.
  Only the grand total shows the currency symbol.
- Quick sign in: after a normal logout the login screen offers the last account on this device. Its refresh
  token is kept in Android's encrypted keystore and is only used after the device lock (fingerprint, face or
  PIN) passes. Removing the account from the login screen or deleting the account revokes it on the server.
- Switching accounts on a device: if the previous account still has changes that never reached the server
  (for example its session was ended by a password reset elsewhere), signing in with a different account asks
  before deleting them. Cancel, then sign in as the previous account while online to sync them first.
- Email links (signup confirmation, password reset) are remembered once used, so reopening the app from Recents
  never replays an old link.
- History and analytics run on local SQLite data: any single date or range, cashier ranking, busiest hours,
  item-wise and cashier-wise sortable tables, revenue charts, and CSV export through the Android share sheet.
- Anonymous web visitors have no table access at all; they only call `public_menu`, `place_customer_order`
  and `customer_order_status`.
- Printer pairing: pair the printer once in Android Bluetooth settings. Scan for printers lists paired devices
  in a picker, highlights likely printers by Bluetooth class and name, and remembers the last connected one.
  Connecting opens a persistent socket (secure SPP, then insecure, then channel 1), the same fallbacks common
  printer apps use.
- Language switches instantly through a string dictionary and per-component RTL layout, not `I18nManager`.
