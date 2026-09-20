# Lagman House public menu (QR ordering)

Static page, no build step. Reads the live menu from Supabase with the anon key and inserts
provisional rows into `customer_orders`. Cashier devices claim them in the app. The restaurant name
switches to Urdu with the language toggle when `restaurant_name_ur` is set in the admin Settings.

## Hosting

Upload this folder to any static host. Examples:

- Netlify: drag and drop the `web` folder onto app.netlify.com/drop
- Vercel: `npx vercel web --prod`
- GitHub Pages: push `web/` to a `gh-pages` branch, or set the Pages source to `/web` on main
- Supabase Storage: create a public bucket `site`, upload the files, use the public URL of `index.html`

Then set `EXPO_PUBLIC_PUBLIC_MENU_URL` in the app `.env` (and the EAS build profile env) to the
hosted URL, without a trailing path. The admin QR screen shows a single QR code for that URL. The page
asks the customer for their table number; it is stored as a hint on the order, not trusted.

## Files

- `index.html`, `styles.css`, `app.js`: the page
- `config.js`: Supabase URL and publishable key (safe to expose; RLS protects the data)
- `logo.png`, `favicon.png`: copied from the app assets
