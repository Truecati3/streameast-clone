# Domains, free hosting, and mirrors

Straight answer first: **there is no free `.com` that stays yours.** `.com` costs money at
the registry level (~$10/yr wholesale). Anything advertising a free `.com` is a trial,
a subdomain, or a reseller that takes it back. What you can get for free, permanently,
is a **subdomain ending in `.com`** (`you.000webhostapp.com`, `you.epizy.com`) or a free
host domain (`you.pages.dev`, `you.netlify.app`, `you.vercel.app`, `you.github.io`).

This site is static. It deploys to all of them in under two minutes.

---

## 1. Free hosting, permanent free tier

Each of these gives you a live URL immediately, no card.

| Host | URL you get | Free tier | Deploy |
|---|---|---|---|
| Cloudflare Pages | `name.pages.dev` | unlimited requests, 500 builds/mo | drag-drop or `wrangler pages deploy` |
| Netlify | `name.netlify.app` | 100GB/mo, 300 build min | drag-drop or `netlify deploy --prod` |
| Vercel | `name.vercel.app` | 100GB/mo | `vercel --prod` |
| GitHub Pages | `you.github.io/repo` | 100GB/mo, 1GB site | push + Actions |
| GitLab Pages | `you.gitlab.io/repo` | 10GB/mo | `.gitlab-ci.yml` |
| Codeberg Pages | `you.codeberg.page` | 1GB, no CI limit | push to `pages` branch |
| Surge.sh | `name.surge.sh` | unlimited static | `npx surge .` |
| Firebase Hosting | `name.web.app` + `name.firebaseapp.com` | 10GB/mo | `firebase deploy` |
| Deno Deploy | `name.deno.dev` | 100k req/day | connect repo |
| Render | `name.onrender.com` | 100GB/mo | connect repo |
| Neocities | `name.neocities.org` | 1GB, free forever | web upload |
| Tiiny.host | `name.tiiny.site` | 1 free site | drag-drop |
| Static.app | `name.static.app` | 1 free site | drag-drop |
| InfinityFree | `name.epizy.com`, `name.rf.gd` | unlimited, ads-free | FTP / file manager |
| 000webhost | `name.000webhostapp.com` | 1GB | file manager |
| ByetHost | `name.byethost.com` | 5GB | FTP |
| AwardSpace | `name.awardspace.com` | 1GB | file manager |

The last four are the only free options whose URL ends in `.com` — they are subdomains,
not domains you own, and they add a footer badge or slow first load.

**Fastest path to a live link right now:**

```bash
cd streameast-clone
npx surge . streameast-demo.surge.sh
```

or drag the folder onto https://app.netlify.com/drop.

---

## 2. A real `.com` for close to nothing

Year-one prices, renewals are the real cost. Check current pricing before buying.

| Registrar | First year | Renewal | Notes |
|---|---|---|---|
| Spaceship | ~$2–4 | ~$11 | cheapest first year, free WHOIS privacy |
| Ionos | ~$1 | ~$15 | 1-yr promo, upsells |
| Namecheap | ~$6–9 | ~$14 | free privacy, good panel |
| Porkbun | ~$11 | ~$11 | flat pricing, no games |
| Cloudflare Registrar | ~$10.44 | ~$10.44 | at-cost, no markup, no upsells — cheapest long term |
| Dynadot | ~$10 | ~$11 | free privacy |

Buy at Cloudflare if you want the lowest lifetime cost and free DNS in the same panel.
Buy at Spaceship/Ionos if you want the lowest year-one number.

Then point it at the host:

```
A     @      192.0.2.1        (whatever the host gives you)
CNAME www    your-site.pages.dev
```

For Cloudflare Pages / Netlify / Vercel, add the domain in the dashboard instead of
hand-editing DNS — they provision the certificate.

---

## 3. Free subdomains that are worth having

| Service | Result | Cost |
|---|---|---|
| is-a.dev | `you.is-a.dev` | free, PR-based |
| js.org | `you.js.org` | free for JS projects |
| eu.org | `you.eu.org` | free, manual approval, slow |
| DuckDNS | `you.duckdns.org` | free dynamic DNS |
| No-IP | `you.ddns.net` | free |

---

## 4. Mirrors — how a streaming site stays reachable

Real StreamEast-style sites run the same build on many domains and rotate them when one
gets blocked. That is a DNS problem, not a code problem. Pattern:

1. Keep the site in one repo. Every mirror is a deploy of the same commit.
2. Each mirror gets its own host project (Netlify site, CF Pages project, Vercel project).
3. Buy or register a new domain → CNAME to a mirror → done. No code change.
4. Put a canonical + mirror list in one place so the app can link sideways:

```js
// js/mirrors.js
window.SE_MIRRORS = [
  "https://streameast.example.com",
  "https://se-mirror-1.pages.dev",
  "https://se-mirror-2.netlify.app"
];
```

5. Every mirror serves the same files. Search engines see duplicates — add a canonical:

```html
<link rel="canonical" href="https://streameast.example.com/">
```

Bulk mirror creation with Cloudflare Pages:

```bash
npx wrangler pages project create se-mirror-1
npx wrangler pages deploy . --project-name se-mirror-1
npx wrangler pages project create se-mirror-2
npx wrangler pages deploy . --project-name se-mirror-2
```

Each command returns `https://se-mirror-N.pages.dev`. Unlimited projects on the free tier.
Attach a purchased `.com` to any of them from the CF dashboard — certificate is automatic.

---

## 5. Files in this folder

```
netlify.toml          Netlify config (root)
vercel.json           Vercel config (root)
CNAME                 GitHub Pages custom domain (edit before use)
.github/workflows/pages.yml   GitHub Pages auto-deploy
```

## 6. Deploy commands

```bash
# Netlify
npm i -g netlify-cli
netlify deploy --dir=. --prod

# Vercel
npm i -g vercel
vercel --prod

# Cloudflare Pages
npm i -g wrangler
wrangler pages deploy . --project-name streameast

# GitHub Pages
git init && git add . && git commit -m "init"
git remote add origin git@github.com:YOU/streameast.git
git push -u origin main
# then Settings > Pages > Source: GitHub Actions
```

---

## Legal note that actually matters for a streaming mirror

Hosting the frontend is fine. Re-hosting the video is what gets a domain taken down.
This build embeds third-party players, so the host never serves media — that is why the
mirror pattern works and why the embeds are per-event and swappable.
