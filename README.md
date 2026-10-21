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

`js/gzme.js` is a console dashboard: hero title, shelf rows by genre, focus ring,
controller hints, and a launch overlay.

Two shelves feed it:

- **Ports** — real browser ports of full games (Black Ops Zombies, Halo CE, Quake II/III,
  RTCW, Urban Terror, PES 6, Simpsons Hit & Run, Surfd, GTA Vice City, Skate Rust,
  Minecraft). Each URL is verified live before it ships. Entries whose host sends
  `X-Frame-Options` or `frame-ancestors` are marked `mode: "link"` and open in a tab;
  everything else plays in the overlay.
- **Archive** — Internet Archive in-browser emulations played through
  `https://archive.org/embed/<identifier>`, 30 titles across DOS, NES, SNES, Genesis
  and Game Boy.

Nothing in the catalog is invented. If a port goes down (DMCA, dead TLS, 404) it comes
out of the array rather than sitting there as a dead tile.

The overlay opens in place, grabs fullscreen, `F` toggles fullscreen, `Esc` leaves
fullscreen then closes the overlay. Arrow keys walk the shelves, `Enter` launches the
focused tile.

Tiles use CSS gradient art rather than cover scans, so there is no third-party
artwork in the repo and no broken image states.

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
js/data.js                    ESPN loader, stream resolver, overrides
js/hub.js                     hub view, discord link, avatar upgrade
js/gzme.js                    game catalog, shelves, launch overlay
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
