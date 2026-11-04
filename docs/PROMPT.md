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
  features/               public, order-wizard, auth, account, admin (each with its own components/hooks)
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
- After login, if the user has a `preferredLocale`, switch to it.
- **Everything** translated: navigation, buttons, forms, validation messages, status labels, notifications, emails, admin dashboard, empty states, errors, 404.
- Translations live in locale JSON files, split by namespace (common, public, order, account, admin, validation). Provide complete translations for all three languages. Add a small script/test that fails if any key exists in one locale but not the others.
- Flemish Dutch suitable for Belgium (e.g. "gsm", "e-mailadres", "u"-form, Belgian wording), not Netherlands-only phrasing. Natural Turkish.
- Dates, times, numbers and currency (EUR) formatted with `Intl` using the active locale.
- Store the customer's preferred communication language on the profile and on each order.
- Admin-editable content (services, portfolio, text blocks) is stored per locale (translation tables). The admin forms show all three languages side by side (tabs) and require each language to be filled for names/titles.

## 5. Public website

**Home:** hero (editable eyebrow/title/subtitle) with primary CTA "Request a custom order"; featured works; short artist/services introduction; portfolio preview; "How ordering works" (4 steps: send request → artist reviews → personal quote → creation); Instagram section linking to the configured profile URL; contact section; footer.

**Portfolio:** responsive grid, category filter (painting, mural, wall painting, portrait, other), featured items, accessible lightbox (keyboard: arrows/Esc, focus trap) with title, description, category, dimensions, year. Instagram button. No Instagram scraping/API — only the configurable profile URL.

**Services:** active services with image, name, description; each links to the order form with that service preselected. All admin-editable.

**Other:** contact page (from settings + editable text), privacy policy page (editable placeholder text, with a visible notice that the business owner must review it before launch — never claim legal compliance), 404 page, error boundary page.

## 6. Custom order form (`/order`) — single page (decision, replaces the 6-step wizard)

One simple page in the existing dark gallery design (colours and design tokens unchanged — only the order part changes). No steps, no progress indicator. Top to bottom:

1. **Service** (optional) — small option cards for the active services (e.g. painting / wall painting / custom); a "Clear choice" button removes the selection. `?service=<id>` preselects one.
2. **Size** — width × height + unit (cm / m), with the hint "Example: 30 × 40 cm".
3. **Your request / description** — one large textarea (colour, style, idea …), min 20 characters.
4. **Photos** (optional) — "Choose files or drag and drop"; multiple images, JPG/PNG/WebP only, max 8 files, max 10 MB each (constants in `shared`); limits shown; previews (object URLs, revoked on cleanup); remove per file; clear per-file error messages.
5. **Full name** and **email** — side by side on desktop, stacked on phones.
6. **Phone** (optional) — with country code (`+32 …`).
7. **Address** — country (default **Belgium**), city, postal code, street and house number, extra address line (optional).
8. **Privacy checkbox** (required) and the **"Send order"** button.

Removed from the form: budget, deadline, title, separate style/colour/theme fields, wall dimensions/surface, extra instructions and the "what would you like to change" question (the description covers all of these). The admin settings "budget required" / "deadline required" are removed. Existing columns for old orders stay in the database (nullable) and are still shown in the admin order detail when present. The order **title** shown in admin lists is derived on the server (inspiration item title, else service name, else the first words of the description). The **communication language** is not asked: it is saved automatically from the site language at the moment of submission.

**Starting from the catalog (`/order?from=<itemId>`):** above the form a small thumbnail of the work and "You're starting from '…'" with a **Remove** button. The work is stored as the order's inspiration reference (`inspirationItemId`) and the matching service is preselected (`service-match`). Remove clears the reference (the service choice stays editable).

**Accounts:** no password is asked and no account is required.
- **Logged-in customer:** name, email, phone and address are prefilled from the profile (editable for this order); the order is linked to the account and appears under "My orders".
- **Guest:** the order is stored without an account (`customerId = null`) and is marked as a guest order. A guest order is **never** linked automatically to an existing account with the same email (privacy). A small "Already have an account? Log in" link keeps the form state.

**Guest tracking link:** after submitting, the confirmation page shows the reference (`ORD-2026-…`) and a private tracking link (`/track#<token>`) with a clear "Save this link" warning and a copy button. Through this link the guest can see the order (status, images) and message the artist. Phase 7 ships a basic tracking page (reference, status, history); phase 8 completes it.
- The token is 32 random bytes (base64url); only `sha256(token)` is stored (`OrderTrackingToken`, with expiry of 12 months and `revokedAt`). The token sits in the URL fragment so it never reaches server logs or `Referer`; the web app sends it in an `X-Order-Token` header.
- The reference alone never grants access. Wrong, expired or revoked tokens → `404` (same response for all cases). Tracking endpoints are rate-limited.
- If SMTP is configured, the link is also emailed (in the communication language — like the password reset this is part of the order, so it does not depend on the admin's "email notifications" switch) and the confirmation page says so; otherwise the page says nothing about email — **never claim an email was sent when it wasn't**. Follow-up emails to guests (status changes, new messages) mention the reference and ask them to open their saved tracking link; they don't contain a new token.

**Submission:** one `multipart/form-data` request (`data` = JSON, `files[]` = images) to `POST /api/orders` (works for guests and logged-in customers). The client generates an `idempotencyKey` (UUID) when the form is opened; `idempotencyKey` is globally unique; a repeated submission returns the existing order (for a guest repeat a fresh tracking token is issued for that same order — knowing the random key is proof of being the submitter); the submit button is disabled while sending. The order is saved in one DB transaction (order + attachments + tracking token + initial status history + admin notification); files stored before a failed transaction are deleted.

**Kept:** validation with one shared Zod schema on client and server (field errors shown inline, focus moves to the first invalid field), full translation in nl-BE / en / tr, phone support (§17), warning when leaving with unsaved data (`beforeunload` + router blocker; not after a successful submit), accessibility (labels, `aria-describedby` errors, keyboard-usable drop zone, live region for submit result) and the security rules of §9.

**Admin:** orders look as before; guest orders get a **"Guest"** badge in the list and detail (contact data comes from the order itself).

Generate a unique, human-readable, **non-sequential** reference like `ORD-2026-7K3QXM` (unambiguous alphabet, retry on collision).

Confirmation page: reference, what happens next, and — logged in → link to the order in the account; guest → the tracking link (see above).

Business rules: never charge anything, never show fixed prices or promise instant quotes; the artist reviews and sends a personal quote.

## 7. Customer account

Register, login, logout, forgot/reset password, change password, profile (name, phone, address, preferred language). Guests without an account use the **tracking page** (`/track#<token>`, see §6): order data, reference images (thumbnails + lightbox), status timeline, quote when sent, message thread, accept quote / cancel — the same order detail component as the account, authorised by the tracking token instead of a session. "My orders" list with status badges and unread indicators; order detail with all submitted data, reference images (thumbnails + lightbox), status timeline, quote amount when sent, and the message thread (send replies). Customer actions on an order: accept a quote (`QUOTE_SENT → ACCEPTED`) and cancel while not yet accepted (with confirmation dialog). In-app notifications: bell in the header with unread count, dropdown/list, mark as read / mark all read; created when the status changes or the admin sends a message. Poll unread counts every ~30 s with React Query (no websockets needed).

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
- **Rate limits:** login, register, forgot/reset password, order submission and message sending.
- **Authorization on the backend:** `requireAuth` and `requireRole('ADMIN')` middleware; customers can only ever load their own orders, attachments, messages and notifications (return `404`, not `403`, for other people's orders); all `/api/admin/*` routes admin-only.
- **Uploads:** check count, size, declared MIME **and magic bytes** (JPEG/PNG/WebP signatures); random server-side file names (UUID + safe extension); customer files stored in a **private** location outside any static folder (or private S3 bucket); served only via `GET /api/attachments/:id` after checking the requester is the owner or an admin, with `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Cache-Control: private`. Admin-uploaded portfolio/service images go to a separate **public** media location.
- `helmet` with a sensible CSP, CORS restricted to the configured web origin with credentials, JSON body size limits, Prisma only (no raw SQL string building), no password hashes or tokens ever in responses or logs; logs must not contain personal data beyond IDs.
- All secrets/URLs from env vars validated at startup (`DATABASE_URL`, `SESSION_SECRET`, `WEB_ORIGIN`, `STORAGE_DRIVER`, S3 vars, SMTP vars, `ADMIN_EMAIL`/`ADMIN_PASSWORD` for the seed). Nothing hardcoded.

## 10. Admin dashboard (`/admin`, separate layout)

Not reachable for guests or customers (route guard in the web app **and** API enforcement).

- **Overview:** total orders, new/awaiting review, in progress, completed, unread customer messages, recent orders, recent customer messages.
- **Orders:** table on desktop / cards on mobile; filter by status and date range, search by reference, customer name, email or phone; include/exclude archived; server-side pagination. **Order detail:** all order data, customer contact + project address, reference images (secure thumbnails + lightbox + download), status timeline, status change control (only allowed transitions, quote amount field when needed, optional note, confirmation), edit order details form, archive button (terminal orders only), for guest orders a **"Create new tracking link"** button (confirmation dialog; revokes all previous links of that order, shows the new link once with a copy button, and emails it to the order's contact email when SMTP is configured — the UI says whether it was emailed; backend route `POST /api/admin/orders/:id/tracking-link`), customer message thread, and a clearly separated **internal notes** panel (visually distinct, labelled "Only visible to administrators").
- **Messaging:** per-order thread, sender + timestamp, read/unread state (messages are marked read when the recipient opens the thread), unread badges in the order list and navigation.
- **Content management** (all with validation, toasts, and confirmation dialogs for destructive actions):
  - Portfolio: create/edit (image upload or URL, category, dimensions, year, featured, published, sample flag, translations), delete, reorder (move up/down buttons — accessible), toggle featured.
  - Services: create/edit/delete (delete blocked if orders reference it — offer "deactivate" instead), active toggle, wall-service flag, image, translations, reorder.
  - Text blocks per language: hero, about, Instagram text, contact intro, business hours, footer tagline, privacy policy.
  - Settings: business name, accent color, Instagram URL, contact email/phone/address, enabled languages (nl-BE always on), email notifications on/off (shows whether SMTP is configured).
- **Email:** if SMTP is configured and enabled, send emails (in the recipient's language) for new messages and status changes, and for password reset. If not configured, show that clearly in the admin settings, and in development log the password-reset link to the server console. **Never claim an email was sent when it wasn't.**

## 11. Database (Prisma)

Models: `User` (role enum ADMIN/CUSTOMER, preferredLocale enum), `CustomerProfile`, `Session`, `PasswordResetToken`, `Order` (customerId nullable for guest orders), `OrderTrackingToken`, `OrderAttachment`, `OrderMessage`, `InternalAdminNote`, `OrderStatusHistory`, `Notification`, `Service` + `ServiceTranslation`, `PortfolioItem` + `PortfolioItemTranslation`, `LocalizedContent` (key + locale unique), `SiteSettings` (single row).

- Enums for roles, locales (`NL_BE`, `EN`, `TR` — map to `nl-BE`/`en`/`tr` in one place), statuses, units, categories, notification types.
- Money and sizes as `Decimal`; deadline as `@db.Date`.
- Orders store the contact + project address submitted for that order (project location may differ from the profile and must remain as submitted) — document this choice in a schema comment.
- Indexes on status, createdAt, customerId, archivedAt, message (orderId, createdAt), notification (userId, readAt).
- Deletion policies: orders, messages, notes, attachments and history use `onDelete: Restrict` (never silently erased); translations cascade from their parent.
- Customer messages and internal notes are separate tables — never one table with a flag.
- Migrations committed; `prisma/seed.ts` (idempotent) creates: the admin from env vars, one demo customer with two demo orders in different statuses (with a message thread and an internal note), 4 services, ~10 sample portfolio items with generated SVG art, all text blocks in 3 languages, default settings.

## 12. API

REST under `/api`, consistent envelopes: success → resource or `{ items, page, pageSize, total, totalPages }`; error → `{ error: { code, message, fields? } }`. Central error handler maps Zod errors → 400 with field keys, unknown errors → 500 without leaking details. Validate body, params and query on every route.

Suggested routes (refine as needed and document all of them in OpenAPI):
- `GET /api/site?locale=` (settings + text blocks), `GET /api/services?locale=`, `GET /api/portfolio?locale=&category=`
- `/api/auth`: `csrf`, `register`, `login`, `logout`, `me`, `forgot-password`, `reset-password`, `change-password`
- `PATCH /api/users/me` (profile)
- `/api/orders`: `POST` (multipart), `GET` (own, paginated), `GET /:id`, `POST /:id/status` (customer accept/cancel), `GET|POST /:id/messages`, `POST /:id/messages/read`
- `GET /api/attachments/:id` (authorized file stream)
- `/api/track` (guest tracking via `X-Order-Token`): `GET /order`, `GET|POST /messages`, `POST /messages/read`, `POST /status`, `GET /attachments/:id`
- `/api/notifications`: list, unread count, mark read, mark all read
- `/api/admin/stats`, `/api/admin/orders` (list/detail/update/status/archive/messages/notes), `/api/admin/portfolio` (+ `reorder`), `/api/admin/services` (+ `reorder`), `/api/admin/content`, `/api/admin/settings`, `/api/admin/media` (public image upload)

## 13. Phases — commit after each

Initialize git at the start (`main` branch). After each phase: run typecheck + tests, fix all errors, then commit with a clear message. If a git remote `origin` exists, push after each commit; if not, remind me to add one (see §15).

1. **Foundation** — monorepo, tsconfigs, docker-compose, `.env.example`, shared package (constants, status rules, schemas, DTO types) with unit tests, Prisma schema + first migration + seed (including SVG placeholder generation). Verify: `docker compose up -d`, migrate, seed succeed.
2. **Backend core** — config, app setup, security middleware, sessions/CSRF/auth, error handling, storage drivers, public endpoints, orders (create with uploads, list, detail), attachments, messages, notifications, customer status actions.
3. **Backend admin** — stats, order management, notes, archive, content/portfolio/services/settings/media, email service, OpenAPI docs.
4. **Backend tests** — see §14. All green.
5. **Frontend foundation** — Vite/Tailwind setup, design tokens, UI component library, i18n (3 complete locales + key-parity check), API client with CSRF handling, layouts, header with language selector + auth menu + notifications bell, footer, 404/error pages.
6. **Public pages** — home, portfolio + lightbox, services, contact, privacy.
7. **Order form + auth pages** — single-page order form (§6), login, register, forgot/reset password, confirmation page.
8. **Customer area** — my orders, order detail with thread/images/timeline/actions, profile, notifications; the guest tracking page (`/track#<token>`) reusing the same order detail (status, images, messages, accept/cancel) with token-based API routes under `/api/track` (order, messages, messages/read, status, attachments/:id).
9. **Admin area** — everything in §10, incl. the "Guest" badge and the "Create new tracking link" button for guest orders (backend ready since phase 7).
10. **Polish & verification** — run the full app, click through every flow in all three languages (guest order → tracking link, logged-in order, customer reply, admin status changes through to COMPLETED, archive, content edits reflected on the public site, language switching, mobile widths). Fix every broken control, missing translation, console error and accessibility issue you find. Production build (`npm run build`) must succeed. Write the README.

## 14. Tests (minimum)

- Shared: status transition rules; order schema (required fields, size, address, optional phone).
- API integration (supertest, real `painter_test` DB, reset between tests): register/login/logout, wrong password, session required, CSRF rejection without header, rate limiting on login; order creation (guest order + tracking link, wrong/expired token rejected, reference alone gives no access, logged-in order linked to the account, guest using the email of an existing account is not linked, address validation, order started from the catalog, idempotent resubmit); upload validation (too many files, too large, wrong MIME, spoofed extension with wrong magic bytes); customer A cannot read customer B's order, attachment, messages (404); customer cannot reach `/api/admin/*` (403); admin list/filter/search/paginate; valid and invalid status transitions incl. quote required; internal notes never appear in customer responses; archive only for terminal orders.
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
- A separate, MeysArt-branded **admin login page** at `/admin/login`: dark design, logo centred, title "Dashboard". Successful login goes to `/admin`. Signing in with a customer account shows "You don't have access to this area". Login rate limiting applies here too.
- Main goal: **the painter can personalise the site herself.**
  - **Portfolio / catalog:** add works by uploading her own photos, edit, reorder, feature, hide and delete. Uploaded photos are automatically resized and optimised for the web.
  - **"Hide all sample works"** button: unpublishes every `isSample = true` item in one click (with a confirmation dialog). Real works never show the "Example" label.
  - **Texts:** home title, about, contact, welcome tagline etc. in 3 languages.
  - **Settings:** site name, logo, accent colour, Instagram, contact details, welcome screen settings.
  - On first login the dashboard shows a short **"Personalise your site" checklist**: upload a logo, add your first work, write the about text, hide the sample works, enter your contact details.
