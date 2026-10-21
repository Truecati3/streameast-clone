# Contributing

This repo is built to be picked up cold — by a person or an agent. `AGENTS.md` is the
working spec: architecture, invariants, conventions, and the three smoke checks that
gate a merge. Read it first.

## Setup

```bash
git clone <your-fork>
cd streameast-clone
python serve.py --port 8080     # http://localhost:8080
npm run check                   # same check CI runs
```

Node 18+ for the check script. Python 3.8+ for the server. No install step, no dependencies.

## Workflow

1. Branch from `main`: `feat/league-filter`, `fix/player-teardown`, `chore/...`.
2. Keep the change scoped to one concern.
3. Run `npm run check` and the three smoke checks in `AGENTS.md`.
4. Open a PR using the template. Say what you ran, not what you intended.
5. Squash merge.

## Ground rules

- No framework, no bundler, no runtime dependency. The site must run as served.
- No invented data in the UI. If a value is not available, show the real absence.
- Every new network call gets an error state with a next action.
- Style from tokens in `:root`. No new colors or easing curves.
- `player.js` owns all media. Nothing else creates `<video>` or `<iframe>`.
- Delete dead code instead of commenting it out.

## Commit messages

```
type(scope): short imperative summary

why this change exists, in one or two sentences
```

`type` is one of `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`.

## Good first issues

- Add a league to `LEAGUES` in `js/data.js`
- Tighten team-name matching in `findMatch`
- Keyboard navigation for the search results list
- Improve skeleton dimensions so first paint matches final layout
- Add a `?league=` deep link that survives reload
