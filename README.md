# Chordasy Public Website Package

This folder is the public website package with images. It is safe to publish on GitHub because it does not include the Chordasy app source code.

## Contents

- `index.html`
- `privacy.html`
- `styles.css`
- `redeem.html`
- `admin.html`
- `promo.css`
- `promo.js`
- `.nojekyll`
- `chordasy_logo_header.png`
- `assets/chordasy_app_icon.png`

## Recommended use

Use this folder for a separate public website repository, for example:

- `Chordasy-site`
- `Chordasy-support`

or use it as the only content in `kakitgameproduction/ChordLab` if you want that repository to be a website-only repository.

## GitHub Pages setup

1. Upload only the contents of this folder to the public repository.
2. Open `Settings > Pages`.
3. Set source to `Deploy from a branch`.
4. Select branch `main`.
5. Select folder `/ (root)`.
6. Save.

## Important

Do not upload the main `ChordVault` project folder if you want to keep the app code private.

## Promo pages

This package now also includes:

- a private-facing redeem page for invited promo code claims
- an admin page for managing promo groups, uploads, claims, and blacklist rules

Those static pages expect a Cloudflare Worker API mounted at `/api/promo`.
The Worker implementation and D1 schema live in:

- [cloudflare-promo/README.md](/Users/kit/Documents/ChordVault/cloudflare-promo/README.md)
- [cloudflare-promo/schema.sql](/Users/kit/Documents/ChordVault/cloudflare-promo/schema.sql)

## Navigation / indexing note (2026-09-04)
- `redeem.html` is linked from the public Resources footer and included in `sitemap.xml`.
- `admin.html` is intentionally not linked from the public site and is not included in `sitemap.xml`. It also carries `noindex, nofollow, noarchive`.
- Hiding the Admin link is not a security control; Admin/API authorization must remain enforced server-side.
