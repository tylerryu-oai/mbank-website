# MBANK Vite mirror

This repository is a Vite-based mirror of [mbank.kg/en](https://mbank.kg/en).
It does not rebuild the MBANK site from components. Instead, it captures MBANK
page snapshots into local JSON files and renders those snapshots inside a small
client-side router so the site can be demoed and modified locally.

## What this repo does

- Mirrors MBANK page HTML into `public/mbank-pages/`.
- Rewrites internal MBANK links so navigation stays inside the local Vite app.
- Loads MBANK's live stylesheets at runtime for visual fidelity.
- Restores a few interactive behaviors locally, including:
  - homepage hero slider
  - desktop navigation dropdowns
  - mobile footer accordions
  - footer branding replacement to `Developed by Codex`

## How it works

There are two main parts:

1. `scripts/sync-mbank.mjs` fetches MBANK pages, rewrites assets and links, and
   writes page snapshots plus a route manifest to `public/mbank-pages/`.
2. `src/main.ts` loads the manifest, fetches the matching page snapshot for the
   current route, injects the HTML into `#app`, and intercepts internal links so
   the local app behaves like a single-page site.

The runtime enhancement layer in `src/enhanceMbank.ts` adds back the small
pieces of behavior that would otherwise be missing from a static HTML snapshot.

## Prerequisites

- Node.js 20+ is recommended.
- Network access is required.

Network access matters because:

- the sync script fetches live content from `https://mbank.kg`
- the local app currently loads MBANK's live CSS, fonts, and image assets

## Install

```bash
npm install
```

## Run locally

Start the Vite dev server:

```bash
npm run dev
```

If you want a fixed local address for demos, pass a host and port:

```bash
npm run dev -- --host 127.0.0.1 --port 4175
```

Then open the URL Vite prints in the terminal.

## Refresh mirrored pages

To re-sync the local snapshot set from the live MBANK site:

```bash
npm run sync:site
```

This command:

- fetches MBANK sitemap entries
- prioritizes English routes first
- crawls a limited amount of internal links from those pages
- stores the result in `public/mbank-pages/manifest.json` and individual JSON
  files in `public/mbank-pages/`

Some routes are skipped intentionally if MBANK does not return a normal
page shell with extractable SSR HTML or stylesheets.

## Build

Create a production build with:

```bash
npm run build
```

Preview the production build with:

```bash
npm run preview
```

## Important files

- `scripts/sync-mbank.mjs`
  - Syncs live MBANK pages into local JSON snapshots.
- `src/main.ts`
  - Loads the route manifest, mounts page HTML, and handles in-app navigation.
- `src/enhanceMbank.ts`
  - Re-adds local interactivity on top of mirrored markup.
- `src/style.css`
  - Holds local patch styles for loading states, mega-menu UI, and footer brand changes.
- `public/mbank-pages/manifest.json`
  - Maps local routes to snapshot files.

## Current limitations

- The mirror still depends on MBANK's live CSS and asset URLs for most of its
  styling and imagery.
- Not every MBANK route is guaranteed to sync cleanly.
- Some interactive flows on the real site are still static in the mirror unless
  they have been explicitly recreated in `src/enhanceMbank.ts`.
- The desktop mega-menu is a local reconstruction based on mirrored route data,
  not the original MBANK menu implementation.

## Typical workflow

1. Run `npm run sync:site` when you want a fresh copy of live MBANK content.
2. Run `npm run dev` and verify the mirrored pages you care about.
3. Make local behavior or styling changes in `src/`.
4. Run `npm run build` before committing.

## Verification

The main manual checks for this repo are:

- homepage loads at `/en`
- internal links navigate without a full page break
- mirrored subpages load from `public/mbank-pages/`
- the desktop nav dropdown opens
- the footer shows `Developed by Codex`

## Notes for future work

- Mirror CSS, fonts, and images locally so the demo no longer depends on MBANK
  at runtime.
- Expand the locally recreated interactions beyond the current hero slider and
  header/footer behavior.
- Add route-level smoke tests for the pages used in demos.
