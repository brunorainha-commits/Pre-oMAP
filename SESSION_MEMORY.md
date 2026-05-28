# PrecoMap Session Memory

Last updated: 2026-05-28

This file is the working memory for the PrecoMap project. It captures the current architecture, business rules, deployment state, major fixes already done, and the next engineering cautions. Do not store private credentials, passwords, Supabase secret keys, service role keys, or raw API secrets in this file.

## Project Identity

- Product name: PrecoMap.
- Purpose: commercial intelligence app for importing Brazilian NF-e XML invoices, mapping customers and products, tracking price history, and calculating price per internal unit.
- Main business problem solved: commercial invoices often sell by package, box, bundle, pack, kit, etc. The app must persist and reuse the internal conversion so the operator can compare price per true internal unit instead of package price.
- User expectation: execute changes directly, keep the app professional, functional, mobile friendly, and deployed to Vercel through GitHub.

## Local Workspace

- Workspace path: `D:\Documents\Projetos\Projeto UBBe Track APP`
- Shell: PowerShell on Windows.
- Main branch: `main`.
- Git remote: `https://github.com/brunorainha-commits/Pre-oMAP.git`
- Public app: `https://precomap.vercel.app`
- Local dev URL commonly used: `http://localhost:5173/`
- Build command: `npm.cmd run build`
- Current app stack: React, TypeScript, Vite, Tailwind, lucide-react, recharts.
- No Supabase SDK dependency is installed. Cloud/auth integration currently uses direct Supabase REST/Auth fetch calls.

## User Preferences

- User wants direct implementation, not long plans.
- User is frustrated by visual clutter, wrong quantities/prices, and repeated manual steps.
- The app must be practical for real operation, not a prototype.
- UI should show all relevant price conversion information clearly.
- Mobile support matters because the user tested login on a phone.
- After meaningful code changes, push to GitHub so Vercel can deploy.

## Security Notes

- Never commit `.env`, `.env.local`, `vercel.env`, secret keys, or Supabase service role keys.
- `.gitignore` now protects `.env`, `.env.*`, `*.env`, and still allows `.env.example`.
- Frontend may use only the Supabase publishable/public key through `VITE_SUPABASE_ANON_KEY`.
- Never put `sb_secret_`, `service_role`, database passwords, or private JWT secrets into Vercel frontend variables.
- Current persistence is a Supabase per-user JSON snapshot protected by RLS. This is functional, but not yet the strongest possible production data model.

## Deployment And Environment

Required Vercel environment variables:

```env
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<supabase-publishable-public-key>
VITE_ALLOW_LOCAL_MODE=false
```

Important:

- The user configured these in Vercel and redeployed.
- The published app was verified after redeploy by checking that the public bundle changed.
- Vercel production deploys from GitHub `main`.
- If login page says Supabase is not configured, Vercel env vars or redeploy are wrong.
- If login says invalid credentials, create or reset the user in Supabase Auth.

## Supabase Current Model

Schema file: `supabase/schema.sql`

Current table:

- `public.precomap_snapshots`

Current table shape:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `data jsonb not null default '{}'::jsonb`
- `updated_at timestamptz not null default now()`

RLS:

- Enabled.
- User can select/insert/update only rows where `auth.uid() = user_id`.

Current sync design:

- Browser data is stored in localStorage.
- On login, the app merges local data and cloud snapshot.
- If cloud is empty and PC has local records, it pushes local data to cloud.
- A manual cloud upload button in the topbar forces sync.
- On another device, logging in with the same user pulls the snapshot.

Important limitation:

- Data is currently one JSON snapshot per user, not normalized Supabase tables.
- For serious multi-user company operation, future migration should create real tables for customers, products, orders, order_items, price_history, uploads, organizations, users, roles, and audit logs.

## Auth Flow

Files:

- `src/components/LoginPage.tsx`
- `src/services/cloudSync.ts`
- `src/App.tsx`

Behavior:

- `signInWithEmail` calls Supabase Auth password grant.
- Session is stored in localStorage key `precomap_cloud_session`.
- On boot, existing session is checked and cloud snapshot sync runs.
- On sign out, the cloud session key is removed.
- Local mode exists only for local development or if `VITE_ALLOW_LOCAL_MODE=true`.

## Cloud Sync Details

File: `src/services/cloudSync.ts`

Synced localStorage keys:

- `precomap_customers`
- `precomap_products`
- `precomap_orders`
- `precomap_order_items`
- `precomap_price_history`
- `precomap_uploads`
- `precomap_user_role`
- `precomap_dismissed_alert_ids`

Important functions:

- `syncCloudSnapshot`
- `pushCloudSnapshot`
- `restoreCloudSnapshot`
- `scheduleCloudBackup`
- `signInWithEmail`
- `getCurrentSession`
- `signOutCloud`

Current behavior:

- Repository saves trigger debounced cloud backup.
- Alert dismissals also trigger backup.
- Login sync merges remote and local data.
- Manual topbar cloud button calls sync and remounts page content.

Known subtlety:

- Data from `localhost:5173` and `precomap.vercel.app` are different browser localStorage origins. To migrate old PC data, user must open the origin that contains the old data, login, and click the cloud sync button.

## Core Business Rules

XML only:

- PDF support was removed.
- `src/services/parsePdf.ts` was deleted.
- There must be no `pdfjs-dist` import.
- There must be no `application/pdf`.
- There must be no `source_file_type: "pdf"`.
- There must be no app text advertising PDF import.

Commercial versus internal pricing:

- Commercial data comes from XML invoice fields.
- Internal data is calculated from package conversion.
- Never confuse quantity with price.
- Package price is commercial unit price.
- Internal unit price is commercial unit price divided by units per package.
- Internal quantity is commercial quantity multiplied by units per package.

Main formulas:

```ts
internal_quantity = commercial_quantity * units_per_package
internal_unit_price = commercial_unit_price / units_per_package
```

Units that do not need package review:

- `UN`
- `UND`
- `PC`
- `PECA`
- `PCA`
- `KG`
- `G`
- `LT`
- `L`
- `ML`
- `M`
- `M2`
- `M3`

Packaging units that require real conversion when units per package is less than or equal to 1:

- `CX`
- `CXA`
- `CAIXA`
- `FD`
- `FARDO`
- `PCT`
- `PACOTE`
- `PACK`
- `EMB`
- `DISPLAY`
- `DZ`
- `DUZIA`
- `KIT`

For these packaging units:

- `units_per_package = 1` is not acceptable without strong review.
- ReviewPage blocks saving until a value greater than 1 is provided.
- The row is highlighted and shows warning text.
- The conversion checkbox is checked by default.

## Product Memory And Recognition

Files:

- `src/services/productMatcher.ts`
- `src/services/normalizer.ts`
- `src/repositories/ProductRepository.ts`
- `src/App.tsx`

Goal:

- If a product was already imported once, the next XML should recognize it by code, barcode, normalized name, or similarity and reuse saved package conversion.

Behavior:

- `ProductRepository.findBestMatchForItem` looks for product matches.
- `applyProductMemoryToInvoice` applies known `units_per_package` and `default_internal_unit`.
- ReviewPage shows that conversion came from product registration.
- Next queued XML reviews re-read product memory before opening.
- Auto import can save multiple XMLs when all conversions are known and validation passes.

## ReviewPage Requirements

File: `src/components/ReviewPage.tsx`

Must show and persist:

- Commercial unit.
- Commercial quantity.
- Commercial unit price.
- Commercial total price.
- Units per package.
- Internal quantity.
- Internal unit.
- Internal unit price.
- Product link/match.
- Checkbox: save this conversion to product registration.

When units per package changes:

- Recalculate internal quantity.
- Recalculate internal unit price.

When linking an existing product:

- Apply product `units_per_package` if available.
- Apply product `default_internal_unit` if available.
- Recalculate internal quantity and internal unit price.

Save validation must block:

- Empty customer.
- No items.
- Commercial quantity less than or equal to 0.
- Commercial unit price less than or equal to 0.
- Commercial total price less than or equal to 0.
- Packaging unit with units per package less than or equal to 1.

## Import And Persistence

File: `src/services/db.ts`

When product is new, save:

- `default_commercial_unit`
- `default_internal_unit`
- `units_per_package`
- `last_package_price`
- `last_internal_unit_price`
- `average_package_price`
- `average_internal_unit_price`
- `min_internal_unit_price`
- `max_internal_unit_price`

When product already exists, update:

- `last_package_price`
- `last_internal_unit_price`
- `average_package_price`
- `average_internal_unit_price`
- `min_internal_unit_price`
- `max_internal_unit_price`
- `last_seen_at`

Conversion overwrite rules:

- If item units per package is greater than 1 and product has no conversion, save it.
- If product has different conversion and user checked save conversion, update it.
- If product has different conversion and user did not confirm, do not overwrite.

Data must persist into:

- Product.
- Order.
- OrderItem.
- PriceHistory.
- ProductsPage.
- PriceHistoryPage.

## Pages And UI Responsibilities

Local search:

- Shared helper: `src/services/search.ts`.
- Searches should be accent-insensitive, punctuation-insensitive, and match CNPJ/CPF with or without mask.
- CustomersPage local search should match name, document, city, state, e-mail, phone, and notes.
- Customer detail purchase history must show both commercial package/box price and internal unit price: commercial unit, commercial quantity, package price, units per package, internal quantity, internal unit, internal price, and total.
- OrdersPage local search should match customer fields, invoice/order identifiers, source file name, issue date, and order item/product fields such as product description, code, barcode, NCM, CFOP, commercial unit, and internal unit.
- PriceHistoryPage has searchable product and customer filters before the selects.

ProductsPage:

- Product modal includes default commercial unit, internal unit, and units per package.
- Product list shows commercial unit, units per package, last package price, and last internal unit price.
- Product detail shows all commercial/internal fields and stats.

PriceHistoryPage:

- Must show commercial unit, commercial quantity, commercial unit price, commercial total price.
- Must show units per package, internal quantity, internal unit, internal unit price.
- Main comparison must be based on internal unit price.

OrdersPage:

- Must format Brazilian currency correctly, for example `1.984,80`, not `1984.80`.
- Mobile layout was improved with card views, but keep checking overflow and truncation.

Topbar:

- Has notification dropdown.
- Has cloud sync button when authenticated.
- Shows user label.
- Sign out button exists.

Alerts:

- Actionable alerts count should only include meaningful/high or medium alerts.
- Informational low-priority alerts stay in central alerts.
- Dismissed alerts persist through localStorage and cloud sync.
- Clicking dismiss must make them disappear.

## Batch XML Import

Files:

- `src/components/UploadPage.tsx`
- `src/App.tsx`

Features:

- User can select multiple XMLs.
- Batch review queue exists.
- Auto-import button exists for clean XMLs with known conversions.
- Duplicate invoices are skipped/blocked.
- A bug where multiple selected XMLs saved the same invoice was fixed by remounting ReviewPage with a stable key.

Known important behavior:

- If conversions are known from product memory, user can use "Salvar automaticamente".
- If new packaging conversions are missing, app sends item to review.

## Branding

Files:

- `src/components/BrandLogo.tsx`
- `public/logo.svg`
- `public/favicon.svg`
- `index.html`

Current state:

- App has a custom PrecoMap logo.
- Login page uses brand presentation.
- Favicon points to custom SVG.

## Formatting And Localization

Currency:

- Use centralized formatters in `src/services/formatters.ts`.
- Brazilian money should appear as `R$ 1.984,80`.
- Avoid raw JS number display in UI.

Date:

- UI is Portuguese/Brazilian.
- Current simulated app label says data simulated until 28 de Maio, 2026.

Encoding:

- Some existing files show mojibake in terminal output because of Windows/codepage display. Be careful not to rewrite large files just to fix encoding unless necessary.

## Manual Test Dataset

Use these simulated products to validate conversion:

Product A:

- Unit: `UN`
- Commercial quantity: 10
- Commercial unit price: 5
- Expected units per package: 1
- Expected internal quantity: 10
- Expected internal unit price: 5

Product B:

- Unit: `CX`
- Commercial quantity: 1
- Commercial unit price: 120
- Units per package: 24
- Expected internal quantity: 24
- Expected internal unit price: 5

Product C:

- Unit: `FD`
- Commercial quantity: 2
- Commercial unit price: 36
- Units per package: 12
- Expected internal quantity: 24
- Expected internal unit price: 3

Product D:

- Unit: `PCT`
- Commercial quantity: 3
- Commercial unit price: 30
- Units per package: 10
- Expected internal quantity: 30
- Expected internal unit price: 3

Product E:

- Unit: `KG`
- Commercial quantity: 5
- Commercial unit price: 20
- Expected units per package: 1
- Expected internal quantity: 5
- Expected internal unit price: 20

Acceptance criterion:

- After saving an XML with product sold as `CX`, the app must show price of box, units per box, internal quantity, and internal unit price in ReviewPage, ProductsPage, PriceHistoryPage, order_items, price_history, and product registration.
- The conversion must be reused automatically in the next import of the same product.

## Important Commits

- `ea2467d` Fix internal unit pricing flow
- `dc4e73f` Reduce noisy alert notifications
- `aa7daf7` Persist dismissed alerts and batch XML review
- `eb6ee50` Improve batch review saving and note layout
- `ca37e09` Fix batch review remount and mobile layout
- `9427e4c` Remember product package conversions
- `60368f5` Add auto import login cloud sync and branding
- `4168421` Sync local data to cloud on login

## Verification History

Last known successful checks:

```powershell
npm.cmd run build
```

Notes:

- Build passed after cloud sync and login changes.
- Vite warns about large chunk size, but build succeeds.
- Browser automation through the available Node/browser tool has been unreliable in this environment, so shell-based deploy verification was used.
- Public Vercel HTML was checked with curl and showed the latest bundle after deploy.

## Next Recommended Engineering Steps

High priority:

- Migrate from one JSON snapshot to normalized Supabase tables with organization/company scope.
- Add user roles tied to Supabase user or organization, not only localStorage.
- Add audit logs for imports, edits, conversion changes, and deletes.
- Add export/backup from Supabase.
- Add stronger duplicate detection using NF-e key and supplier/customer context.

Medium priority:

- Add automated tests for normalizer, product matching, importInvoice persistence, and cloud merge logic.
- Improve mobile ReviewPage and ProductsPage further with compact cards and no horizontal truncation.
- Add visible sync status instead of browser alert popups.
- Add "last synced at" indicator.

Low priority:

- Split bundle with dynamic imports to remove Vite chunk warning.
- Clean up text encoding artifacts in source files carefully.
- Improve report exports and print styles.

## Operational Playbook

To deploy code:

```powershell
npm.cmd run build
git status --short
git add <changed-files>
git commit -m "<message>"
git push origin main
```

To verify production bundle:

```powershell
curl.exe -L https://precomap.vercel.app/
```

To move old PC data to cloud:

1. Open the app in the browser/origin where the data appears.
2. Login with the Supabase user.
3. Click the cloud sync button in the topbar.
4. Open app on phone.
5. Login with the same user.
6. Refresh if needed.

To import many XMLs:

1. Login.
2. Go to Upload de Notas.
3. Select multiple XML files.
4. Use auto-save only when conversions are already known.
5. Review new package conversions once and save them to product registration.
