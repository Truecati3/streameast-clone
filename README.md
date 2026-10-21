# Mothership

Two bays in one hull: **StreamEast** (live sports) and **GZME** (browser games).
Static site, no framework, no bundler, no runtime dependencies.

Live: https://truecati3.github.io/streameast-clone/

## Run

```
python serve.py --port 8080
```

Open http://localhost:8080. A local server avoids `file://` fetch restrictions.

## Routes

| Hash | View |
| --- | --- |
| `#/` | Mothership hub — hero, dock cards, contact |
| `#/stream` | StreamEast home, all leagues |
| `#/stream/l/<league>` | StreamEast filtered by league |
| `#/stream/watch/<gameId>` | StreamEast watch view |
| `#/gzme` | GZME console |

Legacy `#/l/<league>` and `#/watch/<id>` redirect to their `#/stream/...` equivalents
via `location.replace`, so old links keep working. Anything unrecognised falls back to
the hub.

The global nav (`#mnav`) is always mounted. The StreamEast sub-header only shows on
stream routes, and carries an explicit back-to-Mothership pill.

## StreamEast

`js/data.js` pulls the public ESPN scoreboard API per league — real teams, real
schedules, real scores, real team logos. No key, no proxy, CORS is open.

Leagues live in `LEAGUES` (id, label, ESPN path). Add one line to add a league.
Scores refresh every 60s on the home view and are cached for 45s.

Per event, `js/data.js` queries the streamed.pk match API, fuzzy-matches the ESPN
event by team name, then pulls per-source embed URLs. The player renders those in an
iframe: the site never hosts media, it embeds third-party players.

Fallback order:

1. per-event embedded sources
2. your own `.m3u8` set with **+ Add stream** (stored in `localStorage`)
3. public HLS channels from `CHANNELS`

**Test connection** on the watch page checks the match API and the player host and
prints latency, so a dead player is distinguishable from a dead network.

`js/player.js` handles HLS.js for direct `.m3u8`, native HLS on Safari, quality
selector, mute/volume, fullscreen, space/m/f hotkeys, auto-hiding controls, bounded
network retries and server switching.

## GZME

`js/gzme.js` is a PS5-style console home: full-bleed blurred key art behind a single
horizontal icon row, white focus ring on the focused tile, big light title stack
below it, glyph hint bar.

Two sources feed it:

- **Ports** — real browser ports of full games (Black Ops Zombies, Halo CE, Quake II/III,
  RTCW, Urban Terror, PES 6, Simpsons Hit & Run, Surfd, GTA Vice City, Skate Rust,
  Minecraft). Each URL is verified live before it ships. Entries whose host sends
  `X-Frame-Options` or `frame-ancestors` are marked `mode: "link"` and open in a tab;
  everything else plays in the fullscreen overlay.
- **Archive** — Internet Archive in-browser emulations played through
  `https://archive.org/embed/<identifier>`, 30 titles across DOS, NES, SNES, Genesis
  and Game Boy.

Nothing in the catalog is invented. If a port goes down (DMCA, dead TLS, 404) it comes
out of the array rather than sitting there as a dead tile.

**Covers:** every tile carries real art. Ports use the host's own `og:image`, or a
title-screen capture saved in `assets/art/<id>.jpg` for hosts without one. Archive
titles resolve their item thumbnail through `https://archive.org/services/img/<id>`
automatically. A CSS gradient sits behind every tile image, so a dead cover degrades
to colour instead of a broken-image glyph.

The overlay opens in place, grabs fullscreen, `F` toggles fullscreen, `Esc` leaves
fullscreen then closes the overlay. Arrow keys walk the row, `Enter` launches the
focused tile. Scrolling the page moves through the row: the wheel drives the shelf
horizontally and the tile nearest the viewport centre owns the focus ring and the
key art.

## Anime

`js/anime.js` is a miruro-style dark shelf powered by the real AniList GraphQL API
(`https://graphql.anilist.co`, public, no key): trending / all-time popular / top
rated rows, search, and detail pages with banner, cover, genres, synopsis and an
episode grid. All title text and covers come straight from AniList — nothing is
invented; dead data fails into an explicit error state with a retry.

Episodes open the **in-page player**: a fixed overlay with an iframe plus a source
chip row, `Esc` or the Done button closes it. There is no "open in a new tab"
playback anywhere in the tab, by design.

`js/anime-sources.js` (`window.SE_ANIME_SOURCES`) holds the playback sources and
ships **empty**. A source is `{ id, label, url }` where `url` is an embeddable
watch-page template — `{id}` becomes the AniList id, `{ep}` the episode number.
Hosts that refuse iframes (`X-Frame-Options`, `frame-ancestors`) render blank and
the player says so on screen; the chip row exists so you can jump to another
source. The site never hosts, proxies, or resolves media itself — the repo
catalogs metadata and renders a shell around a URL you configure.

## Design

`css/style.css` is the StreamEast token system. `css/mothership.css` is the hub:
black field, serif display type, mono uppercase labels, one orange accent
(`#ff4c25`), sticky nav that solidifies on scroll. `css/gzme.css` is the console:
dark dashboard, gradient tiles, white focus ring, fixed controller bar.

Motion is CSS-only — hero field drift, card rise, shelf reveal, launch fade.
`prefers-reduced-motion` disables all of it.

## Files

```
index.html                    shell: global nav, stream sub-header, #view, footer
css/style.css                 StreamEast design system
css/mothership.css            hub + global nav
css/gzme.css                  GZME console
css/anime.css                 anime shelf + player theme
js/data.js                    ESPN loader, stream resolver, overrides
js/hub.js                     hub view, discord link, avatar upgrade
js/gzme.js                    game catalog, shelves, launch overlay
js/anime-sources.js           anime playback source list (ships empty)
js/anime.js                   AniList catalog, detail views, in-page player
js/app.js                     router, cards, search, reveal
js/player.js                  watch view, HLS/iframe, related
js/mirrors.js                 mirror URL list
assets/pfp.svg                fallback avatar
serve.py                      local static server
DOMAINS.md                    hosting + domain notes
netlify.toml / vercel.json    deploy configs
```

Drop a real photo at `assets/pfp.png` and `upgradePfp()` swaps it in everywhere the
fallback mark is used — no markup change needed.
