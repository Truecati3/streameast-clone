# AGENTS.md — working on this repo

Instructions for AI agents and humans editing this codebase. Read this before touching
anything. The goal is that any agent can land a correct change without asking questions.

## What this is

A static sports-streaming frontend. No framework, no bundler, no build step, no npm
dependencies at runtime. Open `index.html` through a local server and it runs.

```
index.html            app shell, the only HTML file
css/style.css         the entire design system
js/data.js            data layer: ESPN scores, stream resolver, local overrides
js/app.js             hash router, home view, cards, search, reveal
js/player.js          watch view: HLS + iframe embeds, related list
js/mirrors.js         array of mirror URLs
serve.py              local static server, no-store headers
scripts/check.mjs     CI: syntax, asset refs, stub markers
```

Load order matters: `mirrors.js`, `data.js`, `app.js`, `player.js`. All four are classic
scripts exposing globals (`window.SE_DATA`, `window.SE_APP`, `window.SE_PLAYER`). Do not
convert them to ES modules without replacing the file:// support story.

## Invariants — do not break these

1. **No build step.** Every file must run as served. No transpiling, no imports that need
   a bundler, no npm runtime deps.
2. **One data shape.** Everything the UI renders comes from the normalized object built in
   `js/data.js#normalize`. If you need a field, add it there, not in a view.
3. **Media never leaves this domain.** The site embeds third-party players and plays HLS.
   Never add code that proxies or re-hosts video.
4. **`player.js` is the only file that touches video.** Views do not create media elements.
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
Routes are `#/`, `#/l/<league>`, `#/watch/<gameId>` and are parsed in `app.js#parseRoute`.
Extend that function and `route()`. Call `SE_PLAYER.destroy()` on any route that is not a
watch view.

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

Manual smoke, all three must pass:

1. Home renders cards with real team names and logos, no console errors.
2. Clicking a card opens the watch view; sources list populates; a source plays or shows
   an explicit error with a retry.
3. Back returns to home with the league filter intact.

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
