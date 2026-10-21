/* StreamEast clone — catalog, routing, search. Live data from ESPN. */
(function () {
  "use strict";

  const D = window.SE_DATA;
  const view = document.getElementById("view");
  const nav = document.getElementById("leagueNav");
  const searchInput = document.getElementById("searchInput");
  const searchResults = document.getElementById("searchResults");
  const menuBtn = document.getElementById("menuBtn");

  const state = { league: "all" };
  let GAMES = [];
  let refreshTimer = null;
  let routeToken = 0;

  /* ---------- formatting ---------- */

  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function fmtDay(iso) {
    const d = new Date(iso);
    const today = new Date();
    const same =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    if (same) return "Today";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- fragments ---------- */

  function logoHTML(t) {
    const img = t.logo
      ? '<img src="' + esc(t.logo) + '" alt="" loading="lazy" onerror="this.remove()">'
      : "";
    return (
      '<span class="logo" style="background:' +
      esc(t.color) +
      '"><span class="logo-abbr">' +
      esc(t.abbr) +
      "</span>" +
      img +
      "</span>"
    );
  }

  function teamHTML(t, showScore) {
    const score =
      showScore && t.score !== null && t.score !== ""
        ? '<span class="team-score">' + esc(t.score) + "</span>"
        : t.record
        ? '<span class="team-record">' + esc(t.record) + "</span>"
        : "";

    return (
      '<div class="team">' +
      logoHTML(t) +
      '<span class="team-name">' +
      esc(t.name) +
      "</span>" +
      score +
      "</div>"
    );
  }

  function badgeHTML(g) {
    if (g.status === "in") {
      return '<span class="badge live"><span class="pulse"></span>Live</span>';
    }
    if (g.status === "post") {
      return '<span class="badge final">Final</span>';
    }
    return '<span class="badge upcoming">' + esc(fmtTime(g.start)) + "</span>";
  }

  function cardHTML(g) {
    const showScore = g.status !== "pre";
    const footRight = g.broadcast
      ? esc(g.broadcast)
      : g.venue
      ? esc(g.venue)
      : "";

    return (
      '<button class="card" data-watch="' +
      esc(g.id) +
      '" aria-label="Watch ' +
      esc(g.away.name + " vs " + g.home.name) +
      '">' +
      '<div class="card-top">' +
      '<span class="league-chip ' +
      esc(g.league) +
      '">' +
      esc(D.LEAGUE_NAMES[g.league] || g.league) +
      "</span>" +
      badgeHTML(g) +
      "</div>" +
      '<div class="card-body">' +
      teamHTML(g.away, showScore) +
      teamHTML(g.home, showScore) +
      "</div>" +
      '<div class="card-foot">' +
      "<span>" +
      esc(g.status === "in" ? g.statusLabel : fmtDay(g.start) + " · " + fmtTime(g.start)) +
      "</span>" +
      '<span class="foot-right">' +
      footRight +
      "</span>" +
      "</div></button>"
    );
  }

  function sectionHTML(title, list) {
    if (!list.length) return "";
    return (
      '<section class="section">' +
      '<div class="section-head"><h2>' +
      esc(title) +
      '</h2><span class="count">' +
      list.length +
      "</span></div>" +
      '<div class="grid">' +
      list.map(cardHTML).join("") +
      "</div></section>"
    );
  }

  function heroHTML(g) {
    if (!g) return "";
    return (
      '<section class="hero" style="--c1:' +
      esc(g.home.color) +
      ";--c2:" +
      esc(g.away.color) +
      '">' +
      '<div class="hero-bg"></div>' +
      (g.home.logo
        ? '<div class="hero-marks" aria-hidden="true"><img src="' + esc(g.home.logo) + '" alt=""></div>'
        : "") +
      '<div class="hero-body">' +
      '<div class="hero-text">' +
      '<div class="hero-tag"><span class="pulse"></span>Featured · ' +
      esc(D.LEAGUE_NAMES[g.league] || g.league) +
      "</div>" +
      "<h1>" +
      esc(g.away.name) +
      ' <span class="vs">vs</span> ' +
      esc(g.home.name) +
      "</h1>" +
      '<div class="hero-sub">' +
      esc(g.status === "in" ? g.statusLabel : fmtDay(g.start) + " · " + fmtTime(g.start)) +
      (g.venue ? " · " + esc(g.venue) : "") +
      "</div>" +
      "</div>" +
      '<button class="btn-watch" data-watch="' +
      esc(g.id) +
      '">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">' +
      '<path d="M8 5v14l11-7z"/></svg>Watch Now</button>' +
      "</div></section>"
    );
  }

  function skeletonHTML() {
    let cards = "";
    for (let i = 0; i < 6; i++) cards += '<div class="skel-card"></div>';
    return (
      '<div class="skel-hero"></div>' +
      '<div class="section-head"><h2>Loading scoreboard…</h2></div>' +
      '<div class="grid">' +
      cards +
      "</div>"
    );
  }

  function errorHTML(msg) {
    return (
      '<div class="error-box"><h2>Scoreboard unavailable</h2><p>' +
      esc(msg) +
      '</p><button class="btn-watch" id="retryLoad">Try again</button></div>'
    );
  }

  /* ---------- data ---------- */

  async function ensureData(force) {
    if (!force && GAMES.length) return GAMES;
    const res = await D.load(force);
    GAMES = res.games;
    return GAMES;
  }

  /* ---------- views ---------- */

  function renderNav() {
    nav.innerHTML = D.LEAGUES.map(function (l) {
      return (
        '<a href="#/stream/l/' +
        l.id +
        '" class="' +
        (l.id === state.league ? "active" : "") +
        '">' +
        esc(l.name) +
        "</a>"
      );
    }).join("");
  }

  function filtered() {
    if (state.league === "all") return GAMES.slice();
    return GAMES.filter(function (g) {
      return g.league === state.league;
    });
  }

  function renderHome() {
    const games = filtered();
    const live = games.filter(function (g) { return g.status === "in"; });
    const upcoming = games.filter(function (g) { return g.status === "pre"; });
    const finals = games.filter(function (g) { return g.status === "post"; });

    const featured = live[0] || upcoming[0] || null;
    const label =
      state.league === "all" ? "Live Right Now" : "Live · " + D.LEAGUE_NAMES[state.league];

    let html = heroHTML(featured);
    html += sectionHTML(label, live);
    html += sectionHTML("Upcoming", upcoming);
    html += sectionHTML("Final", finals);

    if (!games.length) {
      html += '<div class="empty">No events on the board for this league right now.</div>';
    }

    view.innerHTML = html;
    revealSections();
  }

  function revealSections() {
    const sections = view.querySelectorAll(".section");
    if (!sections.length) return;

    if (!("IntersectionObserver" in window)) {
      sections.forEach(function (s) { s.classList.add("in"); });
      return;
    }

    const io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }
    );

    sections.forEach(function (s) { io.observe(s); });
  }

  function startRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(function () {
      if (document.hidden) return;
      if (location.hash.indexOf("#/stream/watch/") === 0) return;
      reload(false);
    }, 60000);
  }

  async function reload(force) {
    try {
      await ensureData(force);
      renderHome();
    } catch (e) {
      view.innerHTML = errorHTML(e.message || "Unknown error.");
      const retry = document.getElementById("retryLoad");
      if (retry) retry.addEventListener("click", function () { reload(true); });
    }
  }

  /* ---------- routing ---------- */

  function parseRoute() {
    const hash = location.hash || "#/";

    if (hash === "#/" || hash === "#") {
      return { hub: true, gzme: false, anime: false, watch: null, league: null };
    }
    if (hash.indexOf("#/gzme") === 0) {
      return { hub: false, gzme: true, anime: false, watch: null, league: null };
    }
    if (hash.indexOf("#/anime") === 0) {
      return {
        hub: false,
        gzme: false,
        anime: true,
        animeId: (hash.match(/^#\/anime\/i\/(\d+)/) || [])[1] || null,
        animeSearch: decodeURIComponent((hash.match(/^#\/anime\/s\/(.+)$/) || [])[1] || "") || null
      };
    }
    if (hash.indexOf("#/stream") === 0) {
      return {
        hub: false,
        gzme: false,
        anime: false,
        watch: (hash.match(/^#\/stream\/watch\/([\w-]+)/) || [])[1] || null,
        league: (hash.match(/^#\/stream\/l\/([\w-]+)/) || [])[1] || null
      };
    }

    /* anything else is not a dock — the hub owns unknown hashes */
    return { hub: true, gzme: false, anime: false, watch: null, league: null };
  }

  function setRouteChrome(kind) {
    document.body.setAttribute("data-route", kind);
    const tabs = document.querySelectorAll("#mnavTabs a");
    for (let i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle("active", tabs[i].getAttribute("data-tab") === kind);
    }
    if (kind === "stream") document.title = "StreamEast — Live Sports Streams";
    else if (kind === "anime") document.title = "Anime — Mothership";
    else if (kind === "hub") document.title = "Mothership";
  }

  async function route() {
    const token = ++routeToken;
    const hash = location.hash || "#/";

    /* legacy hashes from before the dock existed */
    if (/^#\/watch\//.test(hash)) {
      location.replace(hash.replace("#/watch/", "#/stream/watch/"));
      return;
    }
    if (/^#\/l\//.test(hash)) {
      location.replace(hash.replace("#/l/", "#/stream/l/"));
      return;
    }

    const r = parseRoute();

    if (r.hub) {
      SE_PLAYER.destroy();
      if (window.SE_GZME) SE_GZME.destroy();
      if (window.SE_ANIME) SE_ANIME.destroy();
      clearInterval(refreshTimer);
      setRouteChrome("hub");
      window.SE_HUB.render(view);
      window.scrollTo(0, 0);
      return;
    }

    if (r.gzme) {
      SE_PLAYER.destroy();
      if (window.SE_ANIME) SE_ANIME.destroy();
      clearInterval(refreshTimer);
      setRouteChrome("gzme");
      window.SE_GZME.render(view);
      window.scrollTo(0, 0);
      return;
    }

    if (r.anime) {
      SE_PLAYER.destroy();
      if (window.SE_GZME) SE_GZME.destroy();
      clearInterval(refreshTimer);
      setRouteChrome("anime");
      window.SE_ANIME.render(view, r.animeId, r.animeSearch);
      window.scrollTo(0, 0);
      return;
    }

    setRouteChrome("stream");
    if (window.SE_ANIME) SE_ANIME.destroy();

    if (r.watch) {
      renderNav();
      view.innerHTML = skeletonHTML();
      SE_PLAYER.destroy();
      try {
        await ensureData(false);
      } catch (e) {
        view.innerHTML = errorHTML(e.message || "Unknown error.");
        return;
      }
      if (token !== routeToken) return;

      const game = GAMES.find(function (g) { return g.id === r.watch; });
      if (!game) {
        location.hash = "#/stream";
        return;
      }
      SE_PLAYER.mount(game);
      return;
    }

    SE_PLAYER.destroy();

    state.league = r.league && D.LEAGUE_NAMES[r.league] ? r.league : "all";
    renderNav();

    if (!GAMES.length) {
      view.innerHTML = skeletonHTML();
      await reload(false);
      if (token !== routeToken) return;
    } else {
      renderHome();
    }

    startRefresh();
  }

  /* ---------- search ---------- */

  function runSearch(q) {
    const term = q.trim().toLowerCase();
    if (!term) {
      searchResults.hidden = true;
      searchResults.innerHTML = "";
      return;
    }

    if (!GAMES.length) {
      searchResults.innerHTML = '<div class="sr-empty">Scoreboard still loading…</div>';
      searchResults.hidden = false;
      return;
    }

    const hits = GAMES.filter(function (g) {
      return (
        g.away.name.toLowerCase().indexOf(term) !== -1 ||
        g.home.name.toLowerCase().indexOf(term) !== -1 ||
        (D.LEAGUE_NAMES[g.league] || "").toLowerCase().indexOf(term) !== -1
      );
    }).slice(0, 8);

    if (!hits.length) {
      searchResults.innerHTML = '<div class="sr-empty">No matches for "' + esc(q) + '"</div>';
      searchResults.hidden = false;
      return;
    }

    searchResults.innerHTML = hits
      .map(function (g) {
        return (
          '<button class="sr-item ' +
          (g.status === "post" ? "done" : "") +
          '" data-watch="' +
          esc(g.id) +
          '">' +
          '<span class="sr-dot"></span>' +
          "<span>" +
          esc(g.away.name) +
          " vs " +
          esc(g.home.name) +
          "</span>" +
          '<span class="sr-meta">' +
          esc(g.status === "in" ? "LIVE" : fmtTime(g.start)) +
          "</span></button>"
        );
      })
      .join("");
    searchResults.hidden = false;
  }

  /* ---------- events ---------- */

  document.addEventListener("click", function (e) {
    const watchEl = e.target.closest("[data-watch]");
    if (watchEl) {
      e.preventDefault();
      const id = watchEl.getAttribute("data-watch");
      searchResults.hidden = true;
      searchInput.value = "";
      if (location.hash === "#/stream/watch/" + id) route();
      else location.hash = "#/stream/watch/" + id;
      return;
    }
    if (!e.target.closest(".search")) searchResults.hidden = true;
  });

  searchInput.addEventListener("input", function () {
    runSearch(searchInput.value);
  });

  searchInput.addEventListener("focus", function () {
    if (searchInput.value.trim()) runSearch(searchInput.value);
  });

  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      searchResults.hidden = true;
      searchInput.blur();
    }
    if (e.key === "Enter") {
      const first = searchResults.querySelector("[data-watch]");
      if (first) first.click();
    }
  });

  menuBtn.addEventListener("click", function () {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  nav.addEventListener("click", function () {
    nav.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
  });

  window.addEventListener("hashchange", route);
  window.addEventListener("DOMContentLoaded", route);

  /* header state + keyboard access */
  const hdr = document.querySelector(".hdr");

  function onScroll() {
    if (hdr) hdr.classList.toggle("scrolled", window.scrollY > 6);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  document.addEventListener("keydown", function (e) {
    if (e.key !== "/") return;
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    e.preventDefault();
    searchInput.focus();
  });

  window.SE_APP = {
    games: function () {
      return GAMES.slice();
    }
  };
})();
