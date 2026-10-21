# StreamEast clone

Sports streaming frontend: live scoreboard, event cards, embedded players, related games.

## Run

```
python serve.py --port 8080
```

Open http://localhost:8080. A local server avoids file:// fetch restrictions.

## Data

`js/data.js` pulls the public ESPN scoreboard API per league — real teams, real
schedules, real scores, real team logos. No key, no proxy, CORS is open.

Leagues live in `LEAGUES` (id, label, ESPN path). Add one line to add a league.

Scores refresh every 60s on the home view and are cached for 45s.

## Streams

Per event, `js/data.js` queries the streamed.pk match API, fuzzy-matches the ESPN
event by team name, then pulls per-source embed URLs. The player renders those in an
iframe, which is the same model a StreamEast-style mirror uses: the site never hosts
media, it embeds third-party players.

Fallback order:

1. per-event embedded sources
2. your own `.m3u8` set with **+ Add stream** (stored in `localStorage`)
3. public HLS channels from `CHANNELS`

**Test connection** on the watch page checks the match API and the player host and
prints latency, so a dead player is distinguishable from a dead network.

## Player

HLS.js for direct `.m3u8`, native HLS on Safari, quality selector, mute/volume,
fullscreen, space/m/f hotkeys, auto-hiding controls, bounded network retries,
server switching.

## Design system

`css/style.css` is token-driven: surface ramp, single accent, 7/10/14/18 radii,
three shadow levels, one easing curve (`--ease`) and three durations. Motion is
CSS-only — card rise with stagger via `:nth-child`, hero drift, section reveal
through IntersectionObserver, skeleton shimmer. `prefers-reduced-motion` disables
all of it.

## Files

```
index.html                    shell
css/style.css                 design system
js/data.js                    ESPN loader, stream resolver, overrides
js/app.js                     routing, cards, search, reveal
js/player.js                  watch view, HLS/iframe, related
js/mirrors.js                 mirror URL list
serve.py                      local static server
DOMAINS.md                    hosting + domain notes
netlify.toml / vercel.json    deploy configs
```
