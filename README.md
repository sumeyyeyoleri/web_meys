# MeysArt — Painter & Wall Painting Service

Multilingual (nl-BE / en / tr) portfolio and custom-order website for an independent painter:
a dark-gallery Inspiration Catalog, a single-page order form with reference images, a private
tracking link per order (status, images, messages — customers have no account), and a protected
admin dashboard for the artist (the only login, at `/admin/login`).

> This README is completed in the final project phase (setup, deployment and the
> "Before launch" checklist).

## Project documents

- [docs/PROMPT.md](docs/PROMPT.md) — the full project brief: technology, architecture, features,
  security, data model, API and the build phases.
- [docs/FRONTEND_DESIGN.md](docs/FRONTEND_DESIGN.md) — the dark gallery design brief and the
  Inspiration Catalog. It extends PROMPT.md and replaces its visual identity (§3).

## Deployment notes

- **Password reset requires SMTP.** The artist's "forgot password" link (`/admin/forgot-password`)
  is sent by email, so it only works when the SMTP variables are set.
- **Emergency password reset (without SMTP).** Put a new password (at least 10 characters) in
  `ADMIN_PASSWORD` in `server/.env` and run `npm run admin:reset-password`. It sets that password
  for the artist's account (also after the sign-in email was changed in "My account"), signs out
  every session and cancels unused reset links. It only runs when you start it by hand; the
  password is never printed. Afterwards, sign in and choose a new password in "My account".
- **The seed creates the artist's account only once** (from `ADMIN_EMAIL` / `ADMIN_PASSWORD`).
  Running it again never changes the email or password the artist set in "My account".
- **Message translation (optional, DeepL).** With `DEEPL_API_KEY` set, every message gets a
  "Translate" button (dashboard and tracking page). To get a key: create an account at
  [deepl.com/pro-api](https://www.deepl.com/pro-api) (the free "DeepL API Free" plan includes
  500,000 characters a month), open *Account → API Keys*, copy the key into `server/.env` as
  `DEEPL_API_KEY=` and restart the server. Free keys end in `:fx`; the server picks the right
  DeepL address itself. Without a key the button is hidden and everything else works.
  Translations happen only on click and are stored, so a message is never paid for twice
  per language. Mention DeepL in the privacy policy (the sample text already does).
