# Project: Multilingual Painter & Wall Painting Service Website

You are working in an empty folder on my computer. Act as a senior full-stack engineer, software architect and UI/UX designer. Build a complete, production-oriented website for an independent painter and wall painting professional: customers browse the work, submit custom orders with reference images, and talk to the artist; the administrator manages orders, content and customer communication from a protected dashboard.

This is NOT a prototype or static UI. Every visible control must work. Use clean architecture, secure authentication, persistent storage, proper validation and maintainable code.

**Work in the phases described in section 13. Finish, verify and commit one phase before starting the next. At the end of each phase, give me a short summary (what was built, how to run/check it, anything I must do).**

---

## 1. Technology (pinned — do not upgrade to newer majors)

Use these exact major versions; they are stable and known to work together. Do NOT use Prisma 7, TypeScript 7 or Vite 8.

| Area | Choice |
|---|---|
| Monorepo | npm workspaces: `packages/shared`, `server`, `web` |
| Language | TypeScript `~5.9`, `strict: true`, `noUncheckedIndexedAccess: true` |
| Frontend | React 19, Vite 7, `@vitejs/plugin-react` 5, React Router 7 (`react-router-dom`) |
| Styling | Tailwind CSS 4 via `@tailwindcss/vite` |
| Data fetching | `@tanstack/react-query` 5 + one reusable API client module (`web/src/lib/api.ts`) |
| Forms | `react-hook-form` 7 + `@hookform/resolvers` 5 + Zod 4 |
| i18n | `i18next` + `react-i18next`, JSON locale files |
| Backend | Node 20+, Express 5, TypeScript, run with `tsx` in dev, bundled with `tsup` 8 for production |
| Database | PostgreSQL 16, Prisma `~6.19` (`prisma-client-js` generator) |
| Auth | Server-side sessions in the database (details in §9), `argon2` (Argon2id) |
| Uploads | `multer` 2 (memory storage) + storage driver abstraction: local disk (dev) and S3-compatible (`@aws-sdk/client-s3`, prod) |
| Email | `nodemailer` (optional, SMTP via env vars) |
| Security | `helmet`, `express-rate-limit`, `cookie-parser` |
| API docs | OpenAPI 3 spec + `swagger-ui-express` at `/api/docs` |
| Tests | Vitest 3 + `supertest` against a real test database |

Do not add other dependencies unless clearly necessary; justify any addition in your phase summary.

Provide a `docker-compose.yml` that runs PostgreSQL 16 (dev DB `painter` and test DB `painter_test`), plus `.env.example` files. Never commit `.env`.

## 2. Architecture

```
packages/shared/src/      constants, order-status rules, Zod schemas, DTO types (used by BOTH server and web)
server/src/
  config/                 env parsing with Zod (fail fast on bad config)
  domain/                 pure business rules (status transitions, reference generation)
  services/               application logic (orders, auth, messaging, content, notifications, email)
  repositories/           all Prisma queries live here
  http/
    routes/               thin Express routers
    controllers/          parse input -> call service -> map to DTO
    middleware/           auth, roles, csrf, rate limits, validation, error handler
  infrastructure/         prisma client, storage drivers, mailer
  openapi/                API specification
server/prisma/            schema.prisma, migrations, seed.ts
web/src/
  app/                    router, providers, layouts
  lib/                    api client, query keys, formatting (Intl), i18n setup
  components/ui/          Button, Input, Select, Dialog, Toast, Badge, Pagination, EmptyState, Spinner …
  features/               public, order, auth (artist sign-in), admin (each with its own components/hooks)
  locales/nl-BE/*.json, locales/en/*.json, locales/tr/*.json
```

Rules: controllers contain no business logic; services never touch `req`/`res`; Prisma is only used in repositories; components stay small (split anything > ~200 lines); no duplicated validation — the same Zod schemas validate on client and server.

**Validation messages are i18n keys** (e.g. `validation.required`, `validation.email`, `validation.passwordTooShort`). The API returns them unchanged in a consistent error envelope; the web app translates them.

## 3. Visual identity

Modern, minimalist, gallery-inspired: warm neutral backgrounds (off-white / warm stone), one tasteful accent color (configurable by admin, default terracotta `#B4532A`), elegant serif display font + clean sans body (Google Fonts), generous whitespace, large images, refined image grids, subtle transitions only. Fully responsive (mobile first), WCAG AA contrast, visible focus states, full keyboard navigation, `prefers-reduced-motion` respected. No generic corporate template look, no heavy gradients, no glassmorphism.

It must feel like a real artist's portfolio combined with a professional order service.

**Placeholder content:** there are no real assets. Generate your own abstract, painterly SVG placeholder artworks (varied palettes and compositions) and store them as local media. Mark all seeded portfolio items with `isSample = true` and show a small, translated "Example" label on them. Never invent customer testimonials or present samples as real projects.

## 4. Languages (nl-BE default, en, tr)

- Header language selector on every page; choice persisted in `localStorage` and applied on refresh; `<html lang>` updated.
- After the artist logs in, switch to their `preferredLocale`.
- **Everything** translated: navigation, buttons, forms, validation messages, status labels, notifications, emails, admin dashboard, empty states, errors, 404.
- Translations live in locale JSON files, split by namespace (common, public, order, account, admin, validation). Provide complete translations for all three languages. Add a small script/test that fails if any key exists in one locale but not the others.
- Flemish Dutch suitable for Belgium (e.g. "gsm", "e-mailadres", "u"-form, Belgian wording), not Netherlands-only phrasing. Natural Turkish.
- Dates, times, numbers and currency (EUR) formatted with `Intl` using the active locale.
- Store the customer's communication language (the site language when ordering) on each order.
- Admin-editable content (categories, portfolio, text blocks) is stored per locale (translation tables). The admin forms show all three languages side by side (tabs) and require each language to be filled for names/titles.

## 5. Public website

**Home:** hero (editable eyebrow/title/subtitle) with primary CTA "Request a custom order"; featured works; short artist/services introduction; portfolio preview; "How ordering works" (4 steps: send request → artist reviews → personal quote → creation); Instagram section linking to the configured profile URL; contact section; footer.

**Portfolio:** responsive grid, category filter (the artist's own categories, see §10 — only visible categories with at least one published work appear as filter chips; no space/room filter), featured items, accessible lightbox (keyboard: arrows/Esc, focus trap) with title, description, category, dimensions, year. Instagram button. No Instagram scraping/API — only the configurable profile URL.

**Services:** the categories shown on the site (§10, categories) as cards: cover image, name, short description; a category that is also in the order form links to it with that category chosen (`/order?category=<slug>`), one with works also links to its catalog filter. All admin-editable.

**Other:** contact page (from settings + editable text), privacy policy page (editable placeholder text, with a visible notice that the business owner must review it before launch — never claim legal compliance), 404 page, error boundary page.

## 6. Custom order form (`/order`) — single page (decision, replaces the 6-step wizard)

One simple page in the existing dark gallery design (colours and design tokens unchanged — only the order part changes). No steps, no progress indicator. Top to bottom:

1. **Category** (optional) — small option cards for the categories shown in the order form (services were merged into categories); a "Clear choice" button removes the selection. `?category=<slug>` preselects one.
2. **Size** — width × height + unit (cm / m), with the hint "Example: 30 × 40 cm". The unit follows the chosen category's **default unit** (m for murals, shutters and shop windows; cm for canvas, portraits and custom pieces) until the customer picks a unit themselves.
3. **Your request / description** — one large textarea (colour, style, idea …), min 20 characters.
4. **Photos** (optional) — "Choose files or drag and drop"; multiple images, JPG/PNG/WebP only, max 8 files, max 10 MB each (constants in `shared`); limits shown; previews (object URLs, revoked on cleanup); remove per file; clear per-file error messages.
5. **Full name** and **phone** (both required; phone with country code `+32 …`) — side by side on desktop, stacked on phones.
6. **Email** (optional) — when given, the tracking link and updates are also emailed (if SMTP is configured).
7. **Address** — country (default **Belgium**), city, postal code, street and house number, extra address line (optional).
8. **Privacy checkbox** (required) and the **"Send order"** button.

Removed from the form: budget, deadline, title, separate style/colour/theme fields, wall dimensions/surface, extra instructions and the "what would you like to change" question (the description covers all of these). The admin settings "budget required" / "deadline required" are removed. Existing columns for old orders stay in the database (nullable) and are still shown in the admin order detail when present. The order **title** shown in admin lists is derived on the server (inspiration item title, else service name, else the first words of the description). The **communication language** is not asked: it is saved automatically from the site language at the moment of submission.

**Starting from the catalog (`/order?from=<itemId>`):** above the form a small thumbnail of the work and "You're starting from '…'" with a **Remove** button. The work is stored as the order's inspiration reference (`inspirationItemId`) and the matching service is preselected (`service-match`). Remove clears the reference (the service choice stays editable).

**No customer accounts (decision):** this is not a shop. Nobody registers or logs in to order; there is no customer login, registration, password reset, profile, "my orders" page, account menu or customer notification bell. Every order is followed through its private tracking link. The only login is the artist's (`/admin/login`, §18.3).

**Tracking link:** after submitting, the confirmation page shows the reference (`ORD-2026-…`) and a private tracking link (`/track#<token>`) with a clear "Save this link" warning and a copy button. Through this link the customer sees the order (status, images), messages the artist and accepts the quote or cancels — it is the customer's only way to the order. Phase 7 ships a basic tracking page (reference, status, history); phase 8 completes it (§7).
- The token is 32 random bytes (base64url); only `sha256(token)` is stored (`OrderTrackingToken`, with expiry of 12 months and `revokedAt`). The token sits in the URL fragment so it never reaches server logs or `Referer`; the web app sends it in an `X-Order-Token` header.
- The reference alone never grants access. Wrong, expired or revoked tokens → `404` (same response for all cases). Tracking endpoints are rate-limited.
- If the customer gave an email address and SMTP is configured, the link is also emailed (in the communication language — like the password reset this is part of the order, so it does not depend on the admin's "email notifications" switch) and the confirmation page says so; otherwise the page says nothing about email — **never claim an email was sent when it wasn't**. Follow-up emails (status changes, new messages) are only sent when an email address is known; they mention the reference and ask the customer to open the saved tracking link and don't contain a new token.

**Submission:** one `multipart/form-data` request (`data` = JSON, `files[]` = images) to `POST /api/orders` (no account; the response always carries the tracking link). The client generates an `idempotencyKey` (UUID) when the form is opened; `idempotencyKey` is globally unique; a repeated submission returns the existing order with a fresh tracking token for that same order (knowing the random key is proof of being the submitter; the same key with other contact details → `409`); the submit button is disabled while sending. The order is saved in one DB transaction (order + attachments + tracking token + initial status history + admin notification); files stored before a failed transaction are deleted.

**Kept:** validation with one shared Zod schema on client and server (field errors shown inline, focus moves to the first invalid field), full translation in nl-BE / en / tr, phone support (§17), warning when leaving with unsaved data (`beforeunload` + router blocker; not after a successful submit), accessibility (labels, `aria-describedby` errors, keyboard-usable drop zone, live region for submit result) and the security rules of §9.

**Admin:** orders look as before; the contact details come from the order itself (there are no accounts to link to). The artist can create a new tracking link for any order (§10).

Generate a unique, human-readable, **non-sequential** reference like `ORD-2026-7K3QXM` (unambiguous alphabet, retry on collision).

Confirmation page (`/order/sent`): reference, the tracking link (see above) and what happens next.

Business rules: never charge anything, never show fixed prices or promise instant quotes; the artist reviews and sends a personal quote.

## 7. Tracking page — the customer's view of an order (phase 8)

Customers have **no account** (§6). The private link `/track#<token>` opens a page with: all submitted order data, reference images (thumbnails + lightbox, loaded with the token header), status timeline, quote amount when sent, and the message thread (read and reply). Customer actions: accept a quote (`QUOTE_SENT → ACCEPTED`) and cancel while not yet accepted (with confirmation dialog). The page refreshes the thread and status regularly (~30 s polling with React Query). Wrong, expired or replaced links show a clear "This link doesn't work" page with a contact link. Updates reach the customer by email only when an email address was given. Each message shows the sender's language tag (NL/EN/TR); when translation is available the customer can press **"Translate"** under a message (typically the artist's) to read it in the page language and **"Show original"** to go back (§10, message translation; backend route ready since phase 9a: `POST /api/track/messages/:messageId/translate`).

## 8. Order statuses — explicit transition rules (in `packages/shared`)

| From | Admin may move to | Customer may move to |
|---|---|---|
| SUBMITTED | UNDER_REVIEW, CANCELLED | CANCELLED |
| UNDER_REVIEW | AWAITING_CUSTOMER_INFO, QUOTE_SENT, CANCELLED | CANCELLED |
| AWAITING_CUSTOMER_INFO | UNDER_REVIEW, QUOTE_SENT, CANCELLED | CANCELLED |
| QUOTE_SENT | ACCEPTED, UNDER_REVIEW, AWAITING_CUSTOMER_INFO, CANCELLED | ACCEPTED, CANCELLED |
| ACCEPTED | IN_PROGRESS, CANCELLED | — |
| IN_PROGRESS | COMPLETED, CANCELLED | — |
| COMPLETED / CANCELLED | — (terminal) | — |

Moving to `QUOTE_SENT` requires a quote amount. Every change writes `OrderStatusHistory` (from, to, who, optional note) and notifies the other party. Invalid transitions → `409` with `ORDER_INVALID_TRANSITION`. The UI only offers allowed transitions (returned by the API as `allowedTransitions`). Only COMPLETED/CANCELLED orders can be archived; orders are never hard-deleted.

## 9. Security & privacy

- **Sessions:** random 32-byte token in an `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookie; only `sha256(token)` stored in a `Session` table with expiry (e.g. 14 days sliding); rotate on login; delete on logout and on password change/reset (all sessions).
- **CSRF:** double-submit token — a non-HttpOnly `csrf` cookie + required `X-CSRF-Token` header on every non-GET request, compared in constant time; also check `Origin` against the allowed origin.
- **Passwords:** Argon2id; minimum 10 characters; login errors never reveal whether an email exists; reset tokens are random, stored hashed, single-use, expire in 1 hour. Forgot-password always gives the same response.
- **Rate limits:** login, forgot/reset password, order submission, message sending, the tracking routes and message translation.
- **Authorization on the backend:** the only accounts are the artist's (`requireAdmin`: a valid session); all `/api/admin/*` routes, notifications and `GET /api/attachments/:id` need it. Customers reach exactly one order through the tracking token (`/api/track/*`, `X-Order-Token`); everything else returns `404` (same response for unknown, expired and revoked tokens).
- **Uploads:** check count, size, declared MIME **and magic bytes** (JPEG/PNG/WebP signatures); random server-side file names (UUID + safe extension); customer files stored in a **private** location outside any static folder (or private S3 bucket); served only via `GET /api/attachments/:id` after checking the requester is the owner or an admin, with `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Cache-Control: private`. Admin-uploaded portfolio/service images go to a separate **public** media location.
- `helmet` with a sensible CSP, CORS restricted to the configured web origin with credentials, JSON body size limits, Prisma only (no raw SQL string building), no password hashes or tokens ever in responses or logs; logs must not contain personal data beyond IDs.
- All secrets/URLs from env vars validated at startup (`DATABASE_URL`, `SESSION_SECRET`, `WEB_ORIGIN`, `STORAGE_DRIVER`, S3 vars, SMTP vars, optional `DEEPL_API_KEY`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` for the seed's first account and the emergency reset). Nothing hardcoded.
- **Third parties:** a message text is sent to DeepL only when someone presses "Translate" on it; the privacy policy draft says so.

## 10. Admin dashboard (`/admin`, separate layout)

Only for the signed-in artist (route guard in the web app **and** API enforcement).

**Layout (decision):** the dashboard has its own layout, separate from the public site — a side menu on the left (brand, Overview, Orders with an unread-messages badge, Catalog, Categories, Texts, Settings; at the bottom "View site", "My account", "Log out") and the content on the right, with a slim top bar holding the language switcher and the artist's notification bell. On phones the menu is a full-screen sheet (§17). The dashboard is available in all three languages and opens in the artist's saved language (**Turkish by default**); the top-bar switcher saves the choice (`PATCH /api/admin/me`), which is also used for the artist's emails. Built in two steps: **9a** (layout, overview, orders, messages, internal notes, tracking link, notifications, change password) and **9b** (my account, catalog with categories and bulk upload, categories that replaced services, texts, settings, image optimisation), followed by the personalisation checklist and "hide all sample works".

- **Overview:** total orders, new/awaiting review, in progress, completed, unread customer messages, recent orders, recent customer messages. Above them, while anything is left, the **"Personalise your site" checklist** (`GET /api/admin/setup-checklist`): upload a logo (→ Settings), add your first work (a work that is not a sample → Catalog), write the about text (no language still shows the seeded sample `about.body`, and the Dutch one is filled in → Texts), hide the sample works (no published sample → Catalog), enter your contact details (email or phone filled in and none of the seeded placeholder email/phone/address left → Settings). Each step links to its page and is ticked off from the real data, never by hand ("3 / 5 done"); the checklist disappears once all five are done.
- **Orders:** table on desktop / cards on mobile; filter by status and date range, search by reference, customer name, email or phone; include/exclude archived; server-side pagination. The reference is plain text (not link-styled); there is no "Details" button or arrow: the whole row (table) / card (phones) opens the order — hover highlight and pointer cursor, focusable with Tab with a visible focus ring, Enter opens it; its accessible name is "Open order ORD-…". **Order detail:** all order data, customer contact + project address (with **"Message on WhatsApp"** — a `https://wa.me/<digits>` link, local numbers starting with 0 taken as Belgian, `+32`/`0032`, spaces, dots, dashes and a `(0)` trunk prefix after the country code all recognised — and **"Call"** — a `tel:` link — buttons for the phone number; orders without a phone (older orders) show "No phone number" instead), reference images (secure thumbnails + lightbox + download), status timeline, status change control (only allowed transitions, quote amount field when needed, optional note, confirmation), edit order details form, archive button (terminal orders only), a **"Create new tracking link"** button (confirmation dialog; revokes all previous links of that order, shows the new link once with a copy button, and emails it to the order's contact email when SMTP is configured — the UI says whether it was emailed; backend route `POST /api/admin/orders/:id/tracking-link`), customer message thread, and a clearly separated **internal notes** panel (visually distinct, labelled "Only visible to administrators").
- **Messaging:** per-order thread, sender + timestamp, a small tag with the **sender's language** (NL/EN/TR — stored on each message: the artist's dashboard language when sending, the order's communication language for the customer), read/unread state (messages are marked read when the recipient opens the thread), unread badges in the order list and navigation.
- **Message translation (decision, DeepL):** under each message of the other party a **"Translate"** button translates it into the viewer's current language (dashboard language for the artist, page language on the tracking page); **"Show original"** switches back. Only on click, never automatically. Each translation is stored (`MessageTranslation`, unique per message + target language), so the same message is never sent to DeepL twice for one language; a message already in the target language is not sent at all. The key lives in `DEEPL_API_KEY` (`.env`, documented in `.env.example` and the README); without it the button is hidden (`translationAvailable` in the site settings) and everything else works. Translation requests have their own rate limit. DeepL errors are shown in plain words under the message (quota used up → `TRANSLATION_LIMIT_REACHED`, other errors → `TRANSLATION_FAILED`, no key → `TRANSLATION_UNAVAILABLE`) and the original stays visible. Tests use a fake translator and a mocked `fetch` — never the real DeepL.
- **Content management** (all with validation, toasts, and confirmation dialogs for destructive actions):
  - Catalog (`/admin/catalog`, phase 9b): list with a category filter (incl. "Uncategorised"); create/edit in a dialog (image upload on the same screen, category chosen from the list or none, titles/descriptions in NL/EN/TR, dimensions, year, published, featured, "Request similar" toggle, sample flag), one-click publish/unpublish (`POST /api/admin/portfolio/:id/published`) and feature, delete, reorder (move up/down buttons — accessible). Works in a hidden category carry a **"category hidden"** label. **Bulk upload:** several photos into one category at once — each becomes a **draft** (unpublished) work titled from its file name, to be renamed and published.
  - **Categories (decision; services merged into them):** one list for the catalog filters, the services page and the order form. Each category: name and short description in NL/EN/TR (name required), cover image, default unit (m/cm), **"Show on the site"** (catalog filter + services page; off also hides its works) and **"Show in the order form"**, order. Starting list: Horeca, Gyms, Shops & businesses, Home & kids' rooms, Street art & shop windows (m), Canvas & portrait (cm) — all on the site and in the form — and **Custom piece** (`custom`, cm, only in the order form). Categories are a table (`Category` + `CategoryTranslation`), not a fixed list. The artist adds them, edits the name in NL/EN/TR (all three required), reorders, hides/shows and deletes them. The hide button says **"Hide category and its works on the site"**: a hidden category's works disappear from the site everywhere ("All", featured, detail page, "Request similar") and come back unchanged when it is shown again. Deleting a category with works asks for confirmation and moves the works to another category or leaves them **uncategorised** (`categoryId` NULL, `onDelete: SetNull`) — works are never deleted. Several images/works can be uploaded into a category at once (9b). Slugs `horeca`, `gym`, `shops`, `home`, `street-art`, `canvas-portrait`, `custom`. The former space/room data was removed.
  - **Orders and categories (merge migration):** an order stores `categoryId` (SetNull when the category is deleted) and `serviceLabel` — the chosen category's (formerly: service's) name in the order's language, so it is never lost. Older orders: every former service name was copied into `serviceLabel`; canvas/portrait → Canvas & portrait, shutters & windows → Street art & shop windows, custom piece → Custom piece, other services (e.g. mural) → the category of the order's catalog work if any, else no category. The order detail shows "Chosen service" only when the order has no category or the stored name differs from the category's. The former `Service` tables and `Order.serviceId` stay in the database, unused, until a separate confirmed migration removes them.
  - Texts (`/admin/texts`, phase 9b): text blocks grouped by page (home, about, contact & Instagram, footer, privacy), one language at a time (toggle buttons; unsaved edits are kept when switching and marked per language); an empty text shows the Dutch one as placeholder (the site falls back to Dutch); only changed blocks are saved.
  - Settings (`/admin/settings`, phase 9b): business name, contact phone/email/address, Instagram URL, logo (uploaded or removed right away), accent colour (hex field + colour picker + preview + "back to default"), enabled languages (nl-BE always on), email notifications on/off (shows whether SMTP is configured), welcome screen on/off + image. Saving refreshes the public site.
  - **My account (phase 9b, decision):** one page (`/admin/account`; the former `/admin/password` redirects there) where the artist changes the display name (optional `User.name`, shown only in the dashboard), the sign-in email and the password. Email and password changes need the current password and sign out every other session (this device gets a fresh one); an email used by another account is refused (`validation.emailTaken`). Routes: `PUT /api/admin/account/profile`, `POST /api/admin/account/email`, `POST /api/auth/change-password`.
  - **Image optimisation (phase 9b):** every image uploaded in the dashboard (`POST /api/admin/media`: catalog, category covers, welcome screen) is checked (magic bytes), turned upright, scaled to at most 2400 px on the longest side (never enlarged), stripped of metadata (EXIF/GPS) and stored as WebP (sharp). Unreadable files are refused (`validation.fileUnreadable`). Customer order photos are stored as uploaded (private).
  - **"Hide all sample works"** (catalog page): shown only while sample works are published ("N sample works are on the site"); after a confirmation dialog it unpublishes every published `isSample` work in one request (`POST /api/admin/portfolio/hide-samples`, returns `{ hidden }`). Nothing is deleted: the samples stay in the list as drafts and can be published again one by one.
- **Email:** if SMTP is configured and enabled, send emails (in the recipient's language) for new messages and status changes (to the customer only if an email address was given), and for the artist's password reset. If not configured, show that clearly in the admin settings, and in development log the password-reset link to the server console. **Never claim an email was sent when it wasn't.**

## 11. Database (Prisma)

Models: `User` (the artist's login only; preferredLocale enum), `Session`, `PasswordResetToken`, `Order` (no account link; contact email optional), `OrderTrackingToken`, `OrderAttachment`, `OrderMessage` (with the sender's `locale`), `MessageTranslation` (cached DeepL translation, unique per message + target locale, cascades with the message), `InternalAdminNote`, `OrderStatusHistory`, `Notification`, `Category` (cover, default unit, site/order-form switches) + `CategoryTranslation` (name, description), legacy `Service` + `ServiceTranslation` (unused), `PortfolioItem` (optional `categoryId`) + `PortfolioItemTranslation`, `LocalizedContent` (key + locale unique), `SiteSettings` (single row).

- Enums for the order side (`Role` ADMIN/CUSTOMER on messages and status history), locales (`NL_BE`, `EN`, `TR` — map to `nl-BE`/`en`/`tr` in one place), statuses, units, notification types. Catalog categories are a table, not an enum.
- Money and sizes as `Decimal`; deadline as `@db.Date`.
- Orders store the contact + project address submitted for that order (it must remain as submitted) — document this choice in a schema comment.
- Indexes on status, createdAt, customerId, archivedAt, message (orderId, createdAt), notification (userId, readAt).
- Deletion policies: orders, messages, notes, attachments and history use `onDelete: Restrict` (never silently erased); translations cascade from their parent.
- Customer messages and internal notes are separate tables — never one table with a flag.
- Migrations committed; `prisma/seed.ts` (idempotent) creates: the artist's account from env vars **once** (afterwards the seed never changes its email or password — that is done in "My account"; it also never adds a second account after an email change; emergency: `npm run admin:reset-password`, run by hand only, sets the password to `ADMIN_PASSWORD`, signs out every session and cancels unused reset links), demo orders in different statuses (each with a sample Belgian phone number; with a message thread and an internal note; one prints its tracking link), the 7 starting categories with description, cover art and unit (created only on an empty table, so deleted ones stay deleted; existing ones only get empty description/cover/unit filled), 12 sample portfolio items with generated SVG art (each in a starting category), the Instagram link `https://www.instagram.com/meysart__` (replacing the old placeholder unless changed), all text blocks in 3 languages, default settings.

## 12. API

REST under `/api`, consistent envelopes: success → resource or `{ items, page, pageSize, total, totalPages }`; error → `{ error: { code, message, fields? } }`. Central error handler maps Zod errors → 400 with field keys, unknown errors → 500 without leaking details. Validate body, params and query on every route.

Suggested routes (refine as needed and document all of them in OpenAPI):
- `GET /api/site?locale=` (settings + text blocks), `GET /api/categories?locale=` (categories shown on the site or in the order form, with `showOnSite`, `showInOrderForm`, `hasWorks`, description, cover, unit), `GET /api/portfolio?locale=&category=<slug>` (unknown/hidden slug → no works)
- `/api/auth` (the artist only): `csrf`, `login`, `logout`, `me`, `forgot-password`, `reset-password`, `change-password`
- `POST /api/orders` (multipart, no account)
- `GET /api/attachments/:id` (authorized file stream)
- `/api/track` (the customer's order via `X-Order-Token`): `GET /order`, `GET|POST /messages`, `POST /messages/read`, `POST /messages/:messageId/translate`, `POST /status`, `GET /attachments/:id`
- `/api/notifications`: list, unread count, mark read, mark all read
- `/api/admin/stats`, `/api/admin/orders` (list/detail/update/status/archive/messages/notes; `POST /:id/messages/:messageId/translate`), `/api/admin/portfolio` (+ `reorder`), `/api/admin/categories` (+ `reorder`, `/:id/visible`, delete with `?moveTo=`), `/api/admin/content`, `/api/admin/settings`, `/api/admin/media` (public image upload)

## 13. Phases — commit after each

> Order changed (decision): phase 9 (admin area, in steps 9a and 9b) is built **before** phase 8 (tracking page).

Initialize git at the start (`main` branch). After each phase: run typecheck + tests, fix all errors, then commit with a clear message. If a git remote `origin` exists, push after each commit; if not, remind me to add one (see §15).

1. **Foundation** — monorepo, tsconfigs, docker-compose, `.env.example`, shared package (constants, status rules, schemas, DTO types) with unit tests, Prisma schema + first migration + seed (including SVG placeholder generation). Verify: `docker compose up -d`, migrate, seed succeed.
2. **Backend core** — config, app setup, security middleware, sessions/CSRF/auth, error handling, storage drivers, public endpoints, orders (create with uploads, list, detail), attachments, messages, notifications, customer status actions.
3. **Backend admin** — stats, order management, notes, archive, content/portfolio/services/settings/media, email service, OpenAPI docs.
4. **Backend tests** — see §14. All green.
5. **Frontend foundation** — Vite/Tailwind setup, design tokens, UI component library, i18n (3 complete locales + key-parity check), API client with CSRF handling, layouts, header with language selector + auth menu + notifications bell, footer, 404/error pages.
6. **Public pages** — home, portfolio + lightbox, services, contact, privacy.
7. **Order form + admin sign-in** — single-page order form (§6), confirmation page with tracking link, `/admin/login`, `/admin/forgot-password`, `/admin/reset-password`.
8. **Tracking page** — only the customer's order page via the tracking link (§7): status, images, messages (with language tag and "Translate" / "Show original"), accept quote / cancel; token-based API routes under `/api/track` (order, messages, messages/read, status, attachments/:id).
9. **Admin area** — everything in §10, incl. the "Create new tracking link" button (backend ready since phase 7) and the artist's notifications bell.
10. **Polish & verification** — run the full app, click through every flow in all three languages (order → tracking link, order without email, customer reply via the link, admin status changes through to COMPLETED, archive, content edits reflected on the public site, language switching, mobile widths). Fix every broken control, missing translation, console error and accessibility issue you find. Production build (`npm run build`) must succeed. Write the README.

## 14. Tests (minimum)

- Shared: status transition rules; order schema (required name, phone, size, address; optional email).
- API integration (supertest, real `painter_test` DB, reset between tests): artist login/logout, wrong password, session required, CSRF rejection without header, rate limiting on login, admin password reset; no customer account routes exist; order creation (tracking link, order without email, phone required, wrong/expired/revoked token rejected, reference alone gives no access, address validation, order started from the catalog, idempotent resubmit); upload validation (too many files, too large, wrong MIME, spoofed extension with wrong magic bytes); a token opens only its own order and attachments (404 otherwise); `/api/admin/*` without session (401); admin list/filter/search/paginate; valid and invalid status transitions incl. quote required; internal notes never appear in tracking responses; archive only for terminal orders; message translation (on request only, cached per language, own order only, unavailable without key, DeepL errors, rate limit — with a fake translator).
- Web: a few component/unit tests where valuable (e.g. order form validation, catalog start banner, locale key parity).

## 15. README (in English) must include

Prerequisites (Node 20+, Docker Desktop or local PostgreSQL 16, Git), setup steps (`npm install`, copy `.env.example` → `.env`, `docker compose up -d`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`), default dev URLs, seeded admin/demo logins (from env), running tests, production build & deploy notes (env vars, `prisma migrate deploy`, S3 storage, SMTP, HTTPS/secure cookies, reverse proxy), how to add a new translation key, project structure, and a "Before launch" checklist (replace sample content, review privacy policy, configure SMTP, set strong secrets, backups).

## 16. General rules

- Ask me before making destructive changes outside this project folder.
- Don't leave TODOs, stubs or fake buttons. If something depends on an unconfigured external service, show a clear message instead.
- Keep commits focused; never commit secrets, `.env`, `node_modules`, `dist` or uploaded files.

## 17. Device & browser support (permanent requirement)

The site must work without problems on phones and computers:

- **Phones:** iPhone Safari and Android Chrome (latest 2 versions).
- **Computers:** Chrome, Safari, Firefox and Edge (latest 2 versions).
- **Touch:** everything must be usable with a finger (no hover-only interactions; touch targets at least 44×44px).
- **No zoom on iPhone form fields:** the font size of every input, select and textarea is at least 16px, so tapping a field never zooms the page.
- **Safe areas:** the iPhone notch and the bottom home bar must never cover content or controls (use `viewport-fit=cover` with `env(safe-area-inset-*)` padding on fixed and full-screen elements).
- **Mobile keyboard:** when the on-screen keyboard opens, the focused form field stays visible and is not hidden behind the keyboard or behind fixed bars.

## 18. Brand, welcome screen and owner customization (decisions)

### 18.1 Site name: "MeysArt"
- The seeded `businessName` is **MeysArt**. It appears in the navigation, the browser tab title (`<title>`), the footer, emails and the README.
- Without an uploaded logo, the name is shown as a **wordmark** in Cormorant Garamond: "Meys" regular, "Art" italic in the accent colour.
- Admin settings offer an **optional logo upload** (SVG, PNG or WebP). When a logo is set it replaces the wordmark everywhere. Uploaded SVGs must be checked server-side and rejected if they contain scripts, event handlers, external references or other active content.

### 18.2 Welcome screen
- On the first visit to the **home page only**, a full-screen dark welcome screen is shown: large MeysArt logo, a short tagline (3 languages), one featured artwork as a slightly darkened background, and an "Enter the gallery" button.
- Shown **once per browser session** (sessionStorage). A "Skip" link is always visible; Esc and Enter also dismiss it. No animation with `prefers-reduced-motion`.
- It must never block search engines or visitors who arrive directly on another page (e.g. `/catalog`): the page content is rendered underneath, and only `/` shows the welcome screen.
- The admin can turn it on/off and change the background image and the tagline (3 languages).
- Works on phones (§17).

### 18.3 Admin dashboard additions (phase 9)
- A separate, MeysArt-branded **admin login page** at `/admin/login`: dark design, logo centred, title "Dashboard". Successful login goes to `/admin` (until phase 9 builds the dashboard: back to the site, where only the artist sees a "Log out" button). There are no customer accounts, so this is the only login. Login rate limiting applies here too. Forgot/reset password live at `/admin/forgot-password` and `/admin/reset-password`; they need SMTP — without it, the password is changed through `ADMIN_PASSWORD` in `.env` and running the seed again.
- Main goal: **the painter can personalise the site herself.**
  - **Portfolio / catalog:** add works by uploading her own photos, edit, reorder, feature, hide and delete. Uploaded photos are automatically resized and optimised for the web.
  - **"Hide all sample works"** button: unpublishes every `isSample = true` item in one click (with a confirmation dialog). Real works never show the "Example" label.
  - **Texts:** home title, about, contact, welcome tagline etc. in 3 languages.
  - **Settings:** site name, logo, accent colour, Instagram, contact details, welcome screen settings.
  - On first login the dashboard shows a short **"Personalise your site" checklist**: upload a logo, add your first work, write the about text, hide the sample works, enter your contact details.
