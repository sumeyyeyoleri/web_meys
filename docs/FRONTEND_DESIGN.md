# Frontend Design Brief — Dark Gallery + Inspiration Catalog

This file extends PROMPT.md. Apply it from **phase 5 (frontend foundation)** onward. Where it conflicts with PROMPT.md §3 (visual identity), this file wins. Everything else in PROMPT.md (i18n, accessibility, security, no fake buttons, sample-content rules) still applies.

Before starting phase 5, implement the small backend addition in section 6 below (with tests), commit it, then continue with the frontend.

---

## 1. Concept

A dark, museum-like gallery. The artworks are the only strong color on the page; the interface stays quiet, monochrome and elegant. Visitors should feel like they are walking through an exhibition, then be able to say "I want something like this" with one click.

Core idea: **every artwork can be the starting point of an order.** The portfolio doubles as an *Inspiration Catalog*, and each item has a "Request something similar" button that opens the order wizard with that item pre-attached as the reference.

## 2. Design tokens

Define these as CSS custom properties in Tailwind 4's `@theme` (single source of truth). The accent color comes from the admin setting `accentColor`; set it at runtime as `--color-accent` on `<html>`. Change the seed default for `accentColor` to `#E8D3A8`.

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#050505` | Page background |
| `--color-surface` | `#0E0E0E` | Panels, cards, form fields |
| `--color-surface-2` | `#141414` | Floating nav, raised elements |
| `--color-border` | `#262626` | Default borders |
| `--color-border-strong` | `#333333` | Inputs, secondary buttons |
| `--color-text` | `#F2F2F2` | Primary text |
| `--color-text-muted` | `#A3A3A3` | Secondary text (meets 4.5:1 on bg) |
| `--color-text-subtle` | `#8A8A8A` | Labels, captions (meets 4.5:1 on bg) |
| `--color-accent` | `#E8D3A8` (admin-configurable) | Primary CTA background, active step, focus ring |
| `--color-on-accent` | `#0A0A0A` | Text on accent |
| Status colors | muted, desaturated variants (e.g. amber `#D9A441`, green `#7FB28A`, blue `#7DA2D6`, red `#E07A6A`) | Status badges only, always with a text label |

If the admin picks an accent that fails 4.5:1 contrast with `#0A0A0A`, automatically switch `--color-on-accent` to `#FFFFFF` (compute contrast in JS).

**Typography** (Google Fonts, `display=swap`, preconnect):
- Display / headings: **Cormorant Garamond** 400/500 (italic for emphasis). Large, light, generous line-height (1.1–1.15).
- UI / body: **Manrope** 400/500/600, 16px base, line-height 1.6.
- Small uppercase labels: Manrope 12px, letter-spacing 0.12em.

**Shape & spacing:** pill buttons (`border-radius: 999px`), cards and panels 14–20px radius, artwork images 4–6px radius. 8px spacing grid; sections 80–96px vertical padding on desktop, 56px on mobile. Max content width 1200px.

**Motion:** subtle only: 300–500ms ease transitions on transform/opacity, fade-in on scroll for section headings. Respect `prefers-reduced-motion` (disable carousel animation and scroll fades).

**Admin area exception:** the admin dashboard uses the same tokens but must prioritize density and readability: dark surfaces, Manrope everywhere (serif only for page titles), compact tables.

## 3. Layout components

### Floating pill navigation (all public pages)
- Centered, `max-width: 760px`, 28px from the top, background `--color-surface-2`, 1px border, 16px radius.
- Left: business name in Cormorant (from settings). Center: Home, Catalog, Services, About/Contact. Right: language switcher (NL / EN / TR, active one in full white), account/login icon, notifications bell when logged in, and an "Order" button (secondary style with a small paper-plane icon).
- Sticky on scroll, with a slightly stronger background. On mobile it collapses to name + hamburger; the menu opens as a full-screen dark sheet with large serif links, focus trap and Esc to close.

### Buttons
- Primary: accent background, `--color-on-accent` text, pill, min-height 52px.
- Secondary: transparent, `--color-border-strong` border, white text.
- Ghost/text: underline on hover.
- All buttons: min 44×44px touch target, visible 2px accent focus ring with offset.

### Forms (dark)
- Fields: `--color-surface` background, `--color-border-strong` border, 12px radius, 48px min-height, labels above in 14px/600, helper text muted, error text in red token with an icon, `aria-describedby` wiring.
- Selectable cards (radio/checkbox): bordered card; selected state = accent border + `#121212` background + checked native input styled with `accent-color`.

## 4. Pages

### Home
1. **Hero:** centered serif headline (2 lines, editable via text blocks), muted subtitle, no buttons above the fold except what's in the nav.
2. **Curved gallery carousel** (signature element): 7 featured artworks shown on a concave arc, like standing inside a round gallery.
   - Implementation: a flex row of cards; each card gets `transform: perspective(1100px) rotateY(<-offset × 22deg>)` and grows taller towards the edges (`height: 300px + |offset| × 34px`); outermost cards at 55% opacity; the row overflows and is clipped at the viewport edges.
   - Controls: previous/next round buttons + "03 / 08" counter; keyboard ←/→ when focused; swipe on touch; clicking a side card brings it to the center. No autoplay. `aria-roledescription="carousel"`, each slide labelled.
   - Reduced motion: no transitions. Mobile: 3 visible cards with a smaller angle (12deg).
3. **Selected-work panel** directly under the carousel, synced to the centered card: large image (left), and right: "Example" badge + category, serif title, description, a definition list (Space, Example size, Technique, Price = "Personal quote"), primary button **"Request something similar"**, secondary "Browse the full catalog", and a muted note "The selected example will be attached to your order as a reference."
4. **How it works:** 4 numbered steps on dark surface cards (send request → I review → personal quote → creation).
5. **Services preview**, **Instagram band** (profile link button), **contact**, **footer** (with "All images are examples" note while sample content exists).

### Catalog (`/catalog`, replaces "Portfolio")
- Serif title "Inspiration catalog" + one-line intro.
- Filter chips (pill buttons with `aria-pressed`): All + portfolio categories, and a second chip row for **space** (Living room, Bedroom, Kids' room, Kitchen, Café/Shop, Office, Outdoor).
- Responsive grid (`repeat(auto-fill, minmax(240px, 1fr))`), each card: image (button → opens lightbox/detail), serif title, "Category · Space" line, and a small secondary pill **"Request similar →"**.
- Lightbox/detail view: large image, all info, "Request something similar" primary button, prev/next, Esc closes, focus trap.
- Empty state for a filter with no results; skeleton loaders while fetching.
- Keep the URL in sync with filters (`?category=mural&space=kids`) so links are shareable.

### Order wizard (dark)
- Page header: "Back to catalog" link, business name, "Step X / 6".
- Step indicator: 6 equal segments with a 2px top line, active = accent.
- Two-column layout on desktop: form (left, wide) + sticky **summary panel** (right) showing service, references, dimensions, budget, and "Price: personal quote". On mobile the summary becomes a collapsible bar at the bottom.
- **When opened from a catalog item** (`/order?from=<portfolioItemId>`):
  - Show a banner at the top of step 1 with the thumbnail: *"You're starting from 'Starry Terrace'. The example is attached as a reference and the matching service is selected. You can change anything."* + a "Remove" button.
  - Preselect the service mapped from the item's category (mural / wall painting → the wall service; painting / portrait → the matching service; otherwise none).
  - Show an optional textarea "What would you like to change compared to the example?" whose value is stored in `additionalSpecs`.
  - In step 3 (reference images) the catalog item appears as a fixed first reference tile labelled "From the catalog" (removable), alongside the customer's own uploads. It does **not** count against the 8-file upload limit.
  - The review step shows it, and the confirmation page and order detail show "Inspired by: <title>" with the thumbnail.
- All other wizard rules from PROMPT.md §6 stay unchanged.

### Customer account & admin
- Same dark tokens. Orders list as cards on mobile, table on desktop. Status badges: small pill with dot + translated label.
- Admin order detail shows an **"Inspired by"** card (thumbnail + title + link to the portfolio item) when the order has one.
- Admin portfolio editor gets the new **Spaces** multi-select and an **"Show 'Request similar' button"** toggle (default on).

## 5. Placeholder artwork
Keep generating original abstract SVG artworks (no reproductions of famous paintings, no copyrighted works). Make them look painterly on a dark background: rich but slightly muted palettes (deep blues, ochre, terracotta, sage, gold), layered hills, suns/moons, color blocks. Aim for ~12 sample items covering all categories and spaces, all flagged `isSample`.

## 6. Small backend addition (do this first, with tests)
1. Prisma: add `inspirationItemId String?` to `Order` (relation to `PortfolioItem`, `onDelete: SetNull`) and to `PortfolioItem` add `spaces Space[]` (new enum `Space`: LIVING_ROOM, BEDROOM, KIDS_ROOM, KITCHEN, CAFE_SHOP, OFFICE, OUTDOOR) and `allowSimilarRequest Boolean @default(true)`. New migration; update seed.
2. Shared schemas: order submission accepts optional `inspirationItemId`; portfolio upsert accepts `spaces` and `allowSimilarRequest`.
3. Server: on order creation, validate that the item exists, is published and `allowSimilarRequest` is true (otherwise 400 with `validation.invalidInspiration`); include `inspiration: { id, title, imageUrl } | null` (title in the order's locale) in customer and admin order DTOs. Public portfolio endpoint supports `?space=` filter and returns `spaces` and `allowSimilarRequest`.
4. Tests: order with valid inspiration, unpublished/disabled item rejected, DTO includes inspiration, portfolio space filter.
5. Add translations for all new keys in nl-BE, en and tr. Update the OpenAPI spec.

## 7. Done criteria for the design
- Looks consistent on every page, including the 404, auth pages, account and admin.
- WCAG AA contrast everywhere (verify muted text and accent buttons), keyboard-operable carousel, lightbox and filters, visible focus.
- Works at 360px, 768px, 1280px and 1440px widths without horizontal scrolling (except the intentionally clipped carousel).
- Lighthouse accessibility score ≥ 95 on Home, Catalog and Order.
