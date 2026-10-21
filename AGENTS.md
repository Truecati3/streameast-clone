# AGENTS.md — working on this repo

Instructions for AI agents and humans editing this codebase. Read this before touching
anything. The goal is that any agent can land a correct change without asking questions.

## What this is

A static hub: **StreamEast** (sports) and **GZME** (browser games) behind one dock.
No framework, no bundler, no build step, no npm dependencies at runtime. Open
`index.html` through a local server and it runs.

```
index.html            shell: global nav, stream sub-header, #view, footer
css/style.css         StreamEast design system
css/mothership.css    hub + global nav tokens
css/gzme.css          GZME console
css/anime.css         anime shelf theme (tabs local vars on .anime)
js/data.js            data layer: ESPN scores, stream resolver, local overrides
js/hub.js             hub view (hero, dock, contact), avatar upgrade
js/gzme.js            game catalog, shelves, launch overlay
js/anime-sources.js   anime playback source list (ships empty; see below)
js/anime.js           anime catalog via AniList GraphQL, detail views, in-page player
js/app.js             hash router, home view, cards, search, reveal
js/player.js          watch view: HLS + iframe embeds, related list
js/mirrors.js         array of mirror URLs
assets/pfp.svg        fallback avatar
serve.py              local static server, no-store headers
scripts/check.mjs     CI: syntax, asset refs, stub markers
```

Load order matters: `mirrors.js`, `data.js`, `hub.js`, `gzme.js`,
`anime-sources.js`, `anime.js`, `app.js`, `player.js`. All are classic scripts
exposing globals (`window.SE_DATA`, `window.SE_HUB`, `window.SE_GZME`,
`window.SE_ANIME`, `window.SE_PLAYER`). Do not convert them to ES modules
without replacing the `file://` support story.

## Invariants — do not break these

1. **No build step.** Every file must run as served. No transpiling, no imports that need
   a bundler, no npm runtime deps.
2. **One data shape.** Everything the UI renders comes from the normalized object built in
   `js/data.js#normalize`. If you need a field, add it there, not in a view.
3. **Media never leaves this domain.** The site embeds third-party players and plays HLS.
   Never add code that proxies or re-hosts video.
4. **`player.js` is the only file that touches video.** Views do not create media
   elements. The anime in-page player is an iframe shell only — it embeds a URL and
   nothing else.
5. **No hidden state in the DOM.** State lives in module scope; the DOM is rendered from it.
6. **Every network call fails closed.** Wrap fetches, render an explicit empty or error
   state, never a spinner that never resolves.
7. **No dead ends.** Any error the user can hit needs a visible next action (retry, other
   source, back).
8. **CSS reads from tokens.** No raw hex outside `:root`. No new easing curves.

## Common tasks

**Add a league**
1. Append to `LEAGUES` in `js/data.js`: `{ id, name, path: "sport/league" }`, where `path`
   is the ESPN scoreboard path.
2. If it has a streamed.pk category, add it to `CATEGORY_BY_LEAGUE`.
3. If it needs its own channel defaults, tag entries in `CHANNELS`.
4. Run `npm run check`.

**Change the stream source**
`js/data.js#resolveStreams` is the only entry point. It returns
`{ match, streams: [{ name, embedUrl }] }`. Anything with an `embedUrl` renders in an
iframe; anything with a `url` renders through HLS. Keep that contract.

**Add a UI element**
Markup is template strings inside `js/app.js` or `js/player.js`. Style in `css/style.css`
using existing tokens. Bind events through the `on()` helper in `player.js` so teardown
stays correct; `destroy()` must leave nothing attached, playing, or polling.

**Add a route**
Routes are `#/` (hub), `#/stream`, `#/stream/l/<league>`,
`#/stream/watch/<gameId>`, `#/gzme`, `#/anime`, `#/anime/i/<anilistId>` and
`#/anime/s/<term>`, parsed in `app.js#parseRoute`. Extend that function and
`route()`, and set `data-route` on `<body>` through `setRouteChrome` so CSS can
show or hide the StreamEast sub-header. Call `SE_PLAYER.destroy()`,
`SE_GZME.destroy()` and `SE_ANIME.destroy()` on any route that is not their own
view; they own timers and overlays that must not survive a route change.

**Add an anime playback source**
`js/anime-sources.js` (`window.SE_ANIME_SOURCES`) is the only playback config for
the anime tab. Shape: `{ id, label, url }` where `url` is an embeddable
watch-page template with `{id}` (AniList id) and `{ep}` placeholders. The host
must allow iframing — anything sending `X-Frame-Options` or a `frame-ancestors`
CSP renders blank in the player and the chip row exists precisely so the viewer
can switch. The list ships empty on purpose: this repo catalogs metadata and
renders a player shell; it does not pick, vet, or supply playback hosts.

**Add a game to GZME**
Two sources, one shape:

1. **Browser port** — open the URL, confirm it actually plays (a 200 can still be a
   DMCA notice). If the host sends `X-Frame-Options: DENY/SAMEORIGIN` or
   `frame-ancestors`, set `mode: "link"` so it opens in a tab; otherwise leave
   `mode: "embed"`.
2. **Archive emulation** — `https://archive.org/embed/<identifier>` must return 200 and
   must not block framing.

Then add one entry to `PORTS` or `GAMES` in `js/gzme.js`:
`{ id, title, year, platform, genre, art }` (plus `url`/`mode` for ports). `genre` must
be one of `ROWS`, otherwise the tile is unreachable. Never invent a title and never
leave a dead tile in the array — verify, then ship.

**Cover shapes:** ports take `cover` with the host's `og:image` URL, or a 480×480
title-screen capture at `assets/art/<id>.jpg` when the host ships none. Archive entries
skip `cover` — the item thumbnail resolves through
`https://archive.org/services/img/<identifier>` automatically. The gradient behind the
tile catches anything that fails.

## Conventions

- 2-space indent, double quotes, semicolons, `function` declarations over arrow functions
  in library code.
- `var`/`let`/`const`: `const` unless reassigned.
- DOM ids are camelCase (`sourceRow`), classes are kebab-case (`src-btn`).
- Comments explain why, never what. No commented-out code.
- No `console.log` in shipped paths.

## Verify before you claim it works

```bash
npm run check                     # syntax, missing assets, stub markers
python serve.py --port 8080       # then open http://localhost:8080
```

Manual smoke, all must pass:

1. Hub renders hero, dock cards and contact; Discord chip opens `@1387`.
2. Home renders cards with real team names and logos, no console errors.
3. Clicking a card opens the watch view; sources list populates; a source plays or shows
   an explicit error with a retry.
4. Back returns to home with the league filter intact, and the Mothership pill returns
   to the hub.
5. GZME renders the PS5-style row — cover tiles with a white focus ring and blurred
   key art behind the focused tile. A tile launches in the fullscreen overlay;
   `F` toggles fullscreen, `Esc` leaves it and then closes.

`npm run check` is what CI runs. If it fails locally it fails there.

## Things that will get a PR rejected

- Adding a framework, bundler, or runtime dependency.
- A feature that only works on one host (absolute local paths, `file://` assumptions).
- Fake data invented to make a layout look full.
- Committing a token, key, or personal domain.
- Removing the error states to make the demo look cleaner.
- Placeholder markers left in source. `check.mjs` fails on them.

## Where the hard parts are

| Problem | File | Why it's hard |
|---|---|---|
| Team-name matching across providers | `data.js#findMatch` | Token overlap, accents, "FC"/"SC" noise |
| Player teardown | `player.js#destroy` | Timers, HLS instance, iframe src, listeners |
| Stream mode switching | `player.js#playSource` | HLS and iframe have different lifecycles |
| Layout shift on load | `app.js#skeletonHTML` | Skeleton must match final card height |
| Search relevance | `app.js#runSearch` | No backend, everything is client-side |

## Reporting

If something is broken and you cannot fix it, open an issue with the `bug` template and
include: route, browser, console output, and whether the stream API responded.
