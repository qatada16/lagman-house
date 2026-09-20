# Lagman House public menu (QR ordering)

Static page, no build step. Loads one admin's menu through the `public_menu(token)` RPC and places
orders through `place_customer_order(token, items)`. The anon key has no direct table access; the
server validates the menu code, checks every item belongs to that menu and prices it itself. The restaurant name
switches to Urdu with the language toggle when `restaurant_name_ur` is set in the admin Settings.

## Hosting

Upload this folder to any static host. Examples:

- Netlify: drag and drop the `web` folder onto app.netlify.com/drop
- Vercel: `npx vercel web --prod`
- GitHub Pages: push `web/` to a `gh-pages` branch, or set the Pages source to `/web` on main
- Supabase Storage: create a public bucket `site`, upload the files, use the public URL of `index.html`

Then set `EXPO_PUBLIC_PUBLIC_MENU_URL` in the app `.env` (and the EAS build profile env) to the
hosted URL, without a trailing path. The admin QR screen encodes `<URL>/?m=<menu code>`. Without a code
the page shows the default admin's menu read-only and hides the Add buttons. The table number the customer
types is stored as a hint on the order, not trusted.

## Files

- `index.html`, `styles.css`, `app.js`: the page
- `config.js`: Supabase URL and publishable key (safe to expose; RLS protects the data)
- `logo.png`, `favicon.png`: copied from the app assets
