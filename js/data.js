/* StreamEast clone — live data layer.
   Source: ESPN public scoreboard API (no key, CORS: *).
   Stream channels are public HLS feeds; per-event overrides live in localStorage. */
window.SE_DATA = (function () {
  "use strict";

  const LEAGUES = [
    { id: "nba", name: "NBA", path: "basketball/nba" },
    { id: "nfl", name: "NFL", path: "football/nfl" },
    { id: "mlb", name: "MLB", path: "baseball/mlb" },
    { id: "nhl", name: "NHL", path: "hockey/nhl" },
    { id: "ncaa", name: "NCAA", path: "basketball/mens-college-basketball" },
    { id: "soccer", name: "Soccer", path: "soccer/eng.1" },
    { id: "ufc", name: "UFC", path: "mma/ufc" }
  ];

  const LEAGUE_NAMES = LEAGUES.reduce(function (acc, l) {
    acc[l.id] = l.name;
    return acc;
  }, {});

  /* Public live HLS channels, verified reachable with CORS enabled.
     These are linear channels, not per-event feeds — a per-event override
     can be set from the player ("Add stream") and is stored locally. */
  const CHANNELS = [
    {
      name: "Red Bull TV",
      url: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8",
      tags: ["all"]
    },
    {
      name: "CBS Sports Golazo",
      url: "https://dai.google.com/linear/hls/event/7f3Wv6f7QEKfQna22jHqLQ/master.m3u8",
      tags: ["soccer", "all"]
    },
    {
      name: "ACC Digital Network",
      url: "https://raycom-accdn-firetv.amagi.tv/playlist.m3u8",
      tags: ["ncaa", "all"]
    },
    {
      name: "Bahrain Sports 1",
      url: "https://5c7b683162943.streamlock.net/live/ngrp:sportsone_all/playlist.m3u8",
      tags: ["soccer", "ufc"]
    },
    {
      name: "BEK Sports",
      url: "https://cdn3.wowza.com/5/ZWQ1K2NYTmpFbGsr/BEK-WOWZA-1/smil:BEKPRIMEW.smil/playlist.m3u8",
      tags: ["nfl", "ncaa"]
    }
  ];

  const API = "https://site.api.espn.com/apis/site/v2/sports/";
  const CACHE_KEY = "se.scoreboard.v2";
  const CACHE_TTL = 45000;
  const CUSTOM_KEY = "se.customStreams.v1";

  /* ---------- storage ---------- */

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.at || Date.now() - parsed.at > CACHE_TTL) return null;
      return parsed.games;
    } catch (_e) {
      return null;
    }
  }

  function writeCache(games) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), games: games }));
    } catch (_e) {
      /* private mode / quota — cache is optional */
    }
  }

  function readCustomMap() {
    try {
      return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}") || {};
    } catch (_e) {
      return {};
    }
  }

  function getCustomStream(gameId) {
    return readCustomMap()[gameId] || "";
  }

  function setCustomStream(gameId, url) {
    const map = readCustomMap();
    if (url) map[gameId] = url;
    else delete map[gameId];
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(map));
    } catch (_e) {
      /* storage unavailable — override applies to this session only */
    }
  }

  /* ---------- normalisation ---------- */

  function initials(name) {
    return String(name)
      .split(/\s+/)
      .map(function (w) { return w[0] || ""; })
      .join("")
      .slice(0, 3)
      .toUpperCase();
  }

  function competitor(c) {
    const t = c.team || c.athlete || {};
    const color = t.color ? "#" + t.color : "#2b3742";
    let logo = t.logo || "";
    if (!logo && c.athlete && t.id) {
      logo = "https://a.espncdn.com/i/headshots/mma/players/full/" + t.id + ".png";
    }
    return {
      name: t.displayName || "TBD",
      short: t.shortDisplayName || t.name || t.displayName || "TBD",
      abbr: t.abbreviation || initials(t.displayName || "TBD"),
      logo: logo,
      color: color,
      score: c.score !== undefined && c.score !== null ? c.score : null,
      record: (c.records && c.records[0] && c.records[0].summary) || "",
      winner: !!c.winner
    };
  }

  function statusOf(ev) {
    const t = (ev.status && ev.status.type) || {};
    const state = t.state || "pre";
    let label;
    if (state === "in") label = t.shortDetail || t.detail || "Live";
    else if (state === "post") label = t.shortDetail || "Final";
    else label = new Date(ev.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return { state: state, label: label };
  }

  function normalize(ev, leagueId) {
    const comp = (ev.competitions && ev.competitions[0]) || null;
    if (!comp) return null;

    const list = comp.competitors || [];
    const awayC = list.find(function (c) { return c.homeAway === "away"; }) || list[0];
    const homeC = list.find(function (c) { return c.homeAway === "home"; }) || list[1] || list[0];
    if (!awayC || !homeC) return null;

    const status = statusOf(ev);
    const venue = comp.venue && comp.venue.fullName ? comp.venue.fullName : "";
    const broadcast =
      comp.broadcast ||
      (comp.broadcasts && comp.broadcasts[0] && (comp.broadcasts[0].names || []).join(", ")) ||
      "";
    const link = (ev.links || []).find(function (l) { return l.href; });

    return {
      id: leagueId + "-" + ev.id,
      espnId: ev.id,
      league: leagueId,
      name: ev.name || awayC.team ? ev.name : "",
      away: competitor(awayC),
      home: competitor(homeC),
      start: ev.date,
      status: status.state,
      statusLabel: status.label,
      venue: venue,
      broadcast: broadcast,
      link: link ? link.href : ""
    };
  }

  /* ---------- fetching ---------- */

  async function fetchLeague(league) {
    const res = await fetch(API + league.path + "/scoreboard", {
      headers: { Accept: "application/json" }
    });
    if (!res.ok) throw new Error(league.name + ": HTTP " + res.status);
    const json = await res.json();
    return (json.events || [])
      .map(function (ev) { return normalize(ev, league.id); })
      .filter(Boolean);
  }

  async function fetchAll() {
    const results = await Promise.allSettled(
      LEAGUES.map(function (l) { return fetchLeague(l); })
    );

    let games = [];
    let failures = 0;

    results.forEach(function (r) {
      if (r.status === "fulfilled") games = games.concat(r.value);
      else failures += 1;
    });

    if (!games.length) {
      const cached = readCache();
      if (cached) return { games: cached, stale: true, failures: failures };
      throw new Error("No scoreboard data available. Check the network connection.");
    }

    games.sort(function (a, b) {
      if (a.status === "in" && b.status !== "in") return -1;
      if (b.status === "in" && a.status !== "in") return 1;
      if (a.status !== "post" && b.status === "post") return -1;
      if (b.status !== "post" && a.status === "post") return 1;
      return new Date(a.start) - new Date(b.start);
    });

    writeCache(games);
    return { games: games, stale: false, failures: failures };
  }

  async function load(force) {
    if (!force) {
      const cached = readCache();
      if (cached) return { games: cached, stale: false, failures: 0 };
    }
    return fetchAll();
  }

  /* ---------- per-event stream resolver ----------
     streamed.pk exposes today's matches plus per-source embed players.
     Those embed pages are what a StreamEast-style site puts in an iframe. */

  const STREAMED = "https://streamed.pk/api/";
  const CATEGORY_BY_LEAGUE = {
    nba: "basketball",
    ncaa: "basketball",
    nfl: "american-football",
    nhl: "hockey",
    mlb: "baseball",
    soccer: "football",
    ufc: "fight"
  };

  const STOP_WORDS = ["fc", "cf", "sc", "ac", "club", "de", "the", "vs", "at"];

  let matchCache = { at: 0, list: [] };

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  function overlap(name, titleTokens) {
    const tokens = norm(name).filter(function (t) {
      return t.length > 2 && STOP_WORDS.indexOf(t) === -1;
    });
    if (!tokens.length) return 0;
    let hits = 0;
    tokens.forEach(function (t) {
      if (titleTokens.indexOf(t) !== -1) hits += 1;
    });
    return hits / tokens.length;
  }

  function findMatch(game, list) {
    const category = CATEGORY_BY_LEAGUE[game.league];
    const pool = list.filter(function (m) {
      return !category || m.category === category;
    });

    let best = null;
    let bestScore = 0;

    pool.forEach(function (m) {
      const title = norm(m.title).join(" ");
      const titleTokens = norm(m.title);
      const a = overlap(game.away.name, titleTokens);
      const b = overlap(game.home.name, titleTokens);
      if (a < 0.5 || b < 0.5) return;
      const score = a + b;
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
      void title;
    });

    return bestScore >= 1.0 ? best : null;
  }

  async function getMatches(force) {
    if (!force && matchCache.list.length && Date.now() - matchCache.at < 60000) {
      return matchCache.list;
    }
    const res = await fetch(STREAMED + "matches/all", { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("streamed.pk HTTP " + res.status);
    const list = await res.json();
    matchCache = { at: Date.now(), list: Array.isArray(list) ? list : [] };
    return matchCache.list;
  }

  function capitalize(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : s;
  }

  async function streamsForMatch(match) {
    const srcs = (match.sources || []).slice(0, 4);
    const results = await Promise.allSettled(
      srcs.map(function (s) {
        return fetch(STREAMED + "stream/" + encodeURIComponent(s.source) + "/" + encodeURIComponent(s.id), {
          headers: { Accept: "application/json" }
        }).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        });
      })
    );

    const out = [];
    results.forEach(function (r, i) {
      if (r.status !== "fulfilled" || !Array.isArray(r.value)) return;
      const srcName = capitalize(srcs[i].source);
      r.value.forEach(function (s, j) {
        if (!s.embedUrl) return;
        out.push({
          name: srcName + " " + (s.streamNo || j + 1),
          embedUrl: s.embedUrl,
          language: s.language || "",
          hd: !!s.hd,
          viewers: Number(s.viewers) || 0
        });
      });
    });

    out.sort(function (x, y) {
      if (x.hd !== y.hd) return x.hd ? -1 : 1;
      return y.viewers - x.viewers;
    });

    return out;
  }

  async function resolveStreams(game) {
    let match = null;
    try {
      match = findMatch(game, await getMatches());
    } catch (_e) {
      return { match: null, streams: [] };
    }
    if (!match) return { match: null, streams: [] };

    let streams = [];
    try {
      streams = await streamsForMatch(match);
    } catch (_e) {
      streams = [];
    }
    return { match: match, streams: streams };
  }

  /* ---------- stream sources ---------- */

  function sourcesFor(game) {
    const out = [];
    const custom = getCustomStream(game.id);
    if (custom) out.push({ name: "My stream", url: custom, custom: true });

    // League-specific channels first, then the general ones.
    CHANNELS.forEach(function (ch) {
      if (ch.tags.indexOf(game.league) !== -1) {
        out.push({ name: ch.name, url: ch.url, custom: false });
      }
    });
    CHANNELS.forEach(function (ch) {
      if (ch.tags.indexOf("all") !== -1) {
        out.push({ name: ch.name, url: ch.url, custom: false });
      }
    });

    if (!out.length) {
      out.push({ name: "Red Bull TV", url: CHANNELS[0].url, custom: false });
    }
    return out;
  }

  return {
    LEAGUES: LEAGUES,
    LEAGUE_NAMES: LEAGUE_NAMES,
    CHANNELS: CHANNELS,
    load: load,
    sourcesFor: sourcesFor,
    resolveStreams: resolveStreams,
    getCustomStream: getCustomStream,
    setCustomStream: setCustomStream
  };
})();
