/* ANIME — AniList-powered anime shelf with an in-page episode player.
   Catalog data (titles, covers, banners, episode counts) is real AniList
   data. Playback embeds whatever source URLs are configured in
   js/anime-sources.js (window.SE_ANIME_SOURCES) — nothing is hosted,
   proxied, or deep-linked here; sources that block iframes just render
   blank and the panel offers the next source. */
window.SE_ANIME = (function () {
  "use strict";

  const GQL = "https://graphql.anilist.co";

  /* Playback sources come from js/anime-sources.js so they are hot-editable
     without touching this file. Templates may use {id} and {ep}. */
  const SOURCES = window.SE_ANIME_SOURCES || [];

  const MEDIA_FIELDS =
    "id title { romaji english } coverImage { large color } " +
    "episodes seasonYear format averageScore";
  const DETAIL_FIELDS =
    MEDIA_FIELDS +
    " description(asHtml: false) bannerImage genres status " +
    "studios(isMain: true) { nodes { name } } duration";

  /* Per-page render token: stale responses die, view teardown is cheap. */
  let token = 0;

  const cache = { home: null, search: {}, detail: {} };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* AniList descriptions arrive as HTML. Strip through the DOM so nothing
     lands in the page as markup. */
  function plain(s) {
    if (!s) return "";
    const d = document.createElement("div");
    d.innerHTML = s;
    return (d.textContent || "").replace(/\s+/g, " ").trim();
  }

  function title(m) {
    return m.title.english || m.title.romaji || "Untitled";
  }

  function fmt(m) {
    const bits = [];
    if (m.seasonYear) bits.push(m.seasonYear);
    if (m.format) bits.push(String(m.format).replace("TV", "TV"));
    if (typeof m.episodes === "number") bits.push(m.episodes + " ep");
    return bits.join(" · ") || "Anime";
  }

  function activeSource() {
    const k = localStorage.getItem("se-anime-source");
    return SOURCES.find(function (x) { return x.id === k; }) || SOURCES[0] || null;
  }

  function sourceURL(animeId, ep) {
    const src = activeSource();
    if (!src) return null;
    return String(src.url)
      .replace("{id}", encodeURIComponent(animeId))
      .replace("{ep}", encodeURIComponent(ep));
  }

  function poster(m) {
    return (
      '<button class="an-card" data-anime="' + esc(m.id) + '" style="--i:' + m._i +
      '" aria-label="' + esc(title(m)) + '">' +
      '<span class="an-card__pic" style="background:' + esc(m.coverImage.color || "#1c1c22") + '">' +
      '<img src="' + esc(m.coverImage.large) + '" alt="" loading="lazy" decoding="async"' +
      ' onerror="this.remove()">' +
      "</span>" +
      '<span class="an-card__name">' + esc(title(m)) + "</span>" +
      '<span class="an-card__sub">' + esc(fmt(m)) + "</span>" +
      "</button>"
    );
  }

  function rowHTML(name, shelf) {
    if (!shelf) return "";
    return (
      '<section class="an-row">' +
      "<h2>" + esc(name) + "</h2>" +
      '<div class="an-shelf">' + shelf + "</div>" +
      "</section>"
    );
  }

  function skeleton() {
    let out = "";
    for (let r = 0; r < 2; r++) {
      let cells = "";
      for (let i = 0; i < 6; i++) cells += '<div class="an-skel"></div>';
      out += '<div class="an-row"><h2 class="an-skel-line"></h2><div class="an-shelf">' + cells + "</div></div>";
    }
    return out;
  }

  function error(msg) {
    return (
      '<div class="an-error"><h2>Shelf unavailable</h2><p>' +
      esc(msg) +
      '</p><button class="an-btn" data-retry="1">Try again</button></div>'
    );
  }

  const HOME_QUERY =
    "query {" +
    " trending: Page(page: 1, perPage: 18) { media(sort: TRENDING_DESC, type: ANIME) { " + MEDIA_FIELDS + " } }" +
    " popular: Page(page: 1, perPage: 18) { media(sort: POPULARITY_DESC, type: ANIME) { " + MEDIA_FIELDS + " } }" +
    " top: Page(page: 1, perPage: 18) { media(sort: SCORE_DESC, type: ANIME, isAdult: false) { " + MEDIA_FIELDS + " } }" +
    " }";

  function searchQuery() {
    return (
      "query ($s: String) { Page(page: 1, perPage: 24) { media(search: $s, type: ANIME, sort: SEARCH_MATCH) { " +
      MEDIA_FIELDS + " } } }"
    );
  }

  function detailQuery() {
    return (
      "query ($id: Int) { Media(id: $id) { " + DETAIL_FIELDS + " } }"
    );
  }

  async function gql(query, vars) {
    let res;
    try {
      res = await fetch(GQL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: query, variables: vars || {} })
      });
    } catch (e) {
      throw new Error("Network is down — no shelf without it.");
    }
    if (res.status === 429) throw new Error("AniList rate limit hit — wait a beat and retry.");
    if (!res.ok) throw new Error("AniList answered " + res.status + ".");
    const json = await res.json();
    if (json.errors && json.errors.length) {
      throw new Error(json.errors[0].message || "AniList error.");
    }
    if (!json.data) throw new Error("AniList returned nothing usable.");
    return json.data;
  }

  function mark(list) {
    return list.map(function (m, i) { m._i = i; return m; }).map(poster).join("");
  }

  /* ---------- views ---------- */

  function chrome(body, term) {
    return (
      '<div class="anime">' +
      '<div class="an-top">' +
      '<span class="an-logo"><i></i>ANIME</span>' +
      '<div class="an-top__meta">' +
      '<div class="an-search">' +
      '<input id="anSearch" type="search" placeholder="Search titles…" value="' +
      esc(term || "") + '" autocomplete="off" spellcheck="false">' +
      '<button class="an-btn" data-anime-search="1" aria-label="Search">Go</button>' +
      "</div></div></div>" +
      '<div class="an-body">' + body + "</div>" +
      '<div class="an-bar">' +
      '<span class="an-hint">Catalog from AniList · playback through configured embed sources</span>' +
      "</div></div>"
    );
  }

  async function renderHome(view, opts) {
    const t = ++token;
    view.innerHTML = chrome(skeleton(), "");
    document.title = "Anime — Mothership";

    try {
      const d = await gql(HOME_QUERY);
      if (t !== token) return;
      cache.home = d;

      const rows =
        rowHTML("Trending Now", mark(d.trending.media)) +
        rowHTML("All-Time Popular", mark(d.popular.media)) +
        rowHTML("Top Rated", mark(d.top.media));      view.innerHTML = chrome(rows, "");
    } catch (e) {
      if (t !== token) return;
      view.innerHTML = chrome(error(e.message), "");
    }
  }

  function renderSearch(view, term) {
    const t = ++token;
    view.innerHTML = chrome(skeleton(), term);
    document.title = "Anime — search: " + term;

    gql(searchQuery(), { s: term })
      .then(function (d) {
        if (t !== token) return;
        const list = d.Page.media;
        cache.search[term.toLowerCase()] = list;
        const body = list.length
          ? '<div class="an-grid">' + mark(list) + "</div>"
          : '<div class="an-error">Nothing on the shelf for "' + esc(term) + '".</div>';
        view.innerHTML = chrome(body, term);
      })
      .catch(function (e) {
        if (t !== token) return;
        view.innerHTML = chrome(error(e.message), term);
      });
  }

  function sourceChips() {
    if (!SOURCES.length) return "";
    return (
      '<div class="an-mirrors"><span class="an-mirrors__label">Source:</span>' +
      SOURCES.map(function (s) {
        const on = activeSource() && activeSource().id === s.id;
        return (
          '<button class="an-chip' + (on ? " on" : "") + '" data-source="' + esc(s.id) + '">' +
          esc(s.label || s.id) + "</button>"
        );
      }).join("") +
      "<span class=\"an-mirrors__note\">sources that block iframes render blank — switch chips</span>" +
      "</div>"
    );
  }

  function episodesHTML(m) {
    if (typeof m.episodes !== "number" || m.episodes < 1) {
      return (
        '<div class="an-eps">' +
        '<button class="an-ep" data-epwatch="1"><b>' + esc(title(m)) + "</b><span>open player</span></button>" +
        "</div>"
      );
    }
    /* Airtime cap keeps the DOM sane for 100+ ep shows; unknown total = button. */
    const cap = Math.min(m.episodes, 72);
    let out = '<div class="an-eps">';
    for (let i = 1; i <= cap; i++) {
      out += '<button class="an-ep" data-epwatch="' + i + '"><b>EP ' + i + "</b></button>";
    }
    if (m.episodes > cap) {
      out += '<button class="an-ep" data-epwatch="' + m.episodes + '"><b>…EP ' + m.episodes + "</b></button>";
    }
    out += "</div>";
    return out;
  }

  function detailBody(m) {
    const banner = m.bannerImage
      ? '<div class="an-banner" style="background-image:url(' + esc(m.bannerImage) + ')"></div>'
      : '<div class="an-banner an-banner--flat" style="background:' + esc(m.coverImage.color || "#221f26") + '"></div>';

    return (
      banner +
      '<div class="an-detail">' +
      '<div class="an-detail__head">' +
      '<img class="an-detail__pic" src="' + esc(m.coverImage.large) + '" alt="" onerror="this.remove()">' +
      '<div class="an-detail__info">' +
      '<h1>' + esc(title(m)) + "</h1>" +
      '<div class="an-meta">' +
      esc(fmt(m)) +
      (m.averageScore ? " · " + Math.round(m.averageScore / 10) + "/10" : "") +
      (m.duration ? " · " + m.duration + " min/ep" : "") +
      (m.status ? " · " + String(m.status).replace("FINISHED", "finished").replace("RELEASING", "airing") : "") +
      "</div>" +
      '<div class="an-genres">' +
      (m.genres || []).slice(0, 6).map(function (g) { return '<span class="an-chip">' + esc(g) + '</span>'; }).join("") +
      "</div>" +
      (m.studios && m.studios.nodes.length ? '<div class="an-meta">' + esc(m.studios.nodes[0].name) + "</div>" : "") +
      '<p class="an-desc">' + (plain(m.description) || "No synopsis on file.") + "</p>" +
      sourceChips() +
      "</div></div>" +
      "<h2 class=\"an-eps__head\">Episodes · in-page player</h2>" +
      episodesHTML(m) +
      "</div>"
    );
  }

  async function renderDetail(view, id) {
    const t = ++token;
    const cached = cache.detail[id];
    if (cached) {
      view.innerHTML = chrome(detailBody(cached), "");
      document.title = title(cached) + " — Anime";
      return;
    }
    view.innerHTML = chrome(skeleton(), "");
    document.title = "Anime";

    try {
      const d = await gql(detailQuery(), { id: parseInt(id, 10) });
      if (t !== token) return;
      cache.detail[id] = d.Media;
      view.innerHTML = chrome(detailBody(d.Media), "");
      document.title = title(d.Media) + " — Anime";
    } catch (e) {
      if (t !== token) return;
      view.innerHTML = chrome(error(e.message), "");
    }
  }

  function render(view, id, searchTerm) {
    if (searchTerm) {
      renderSearch(view, searchTerm);
      return;
    }
    if (id) renderDetail(view, id);
    else if (cache.home) {
      const d = cache.home;
      view.innerHTML = chrome(
        rowHTML("Trending Now", mark(d.trending.media)) +
        rowHTML("All-Time Popular", mark(d.popular.media)) +
        rowHTML("Top Rated", mark(d.top.media)),
        ""
      );
      document.title = "Anime — Mothership";
    } else {
      renderHome(view);
    }
  }

  function refresh(view) {
    cache.home = null;
    renderHome(view);
  }

  /* ---------- in-page episode player ---------- */

  function playerHTML(m, ep) {
    const src = activeSource();
    const chips = SOURCES.map(function (s) {
      const on = src && src.id === s.id;
      return (
        '<button class="an-chip' + (on ? " on" : "") + '" data-source="' + esc(s.id) + '">' +
        esc(s.label || s.id) + "</button>"
      );
    }).join("");
    const frame = src
      ? '<iframe class="an-player__frame" src="' + esc(sourceURL(m.id, ep)) +
        '" referrerpolicy="origin" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>' +
        '<div class="an-player__note">Black screen? That source refuses iframes — switch the source above or use another episode source. Nothing is hosted or proxied here.</div>'
      : '<div class="an-player__empty">' +
        "<h3>No playback source configured</h3>" +
        "<p>Add a source to <code>js/anime-sources.js</code> — an embeddable watch-page URL template with <code>{id}</code> and <code>{ep}</code> placeholders. Sources that send X-Frame-Options will render blank.</p>" +
        "</div>";

    return (
      '<div class="an-player" role="dialog" aria-label="Episode player">' +
      '<div class="an-player__bar">' +
      '<span class="an-player__title">' + esc(title(m)) + " — EP " + esc(ep) + "</span>" +
      '<div class="an-player__tools">' + chips +
      '<button class="an-btn" data-anclose="1">Done</button>' +
      "</div></div>" +
      frame +
      "</div>"
    );
  }

  function openPlayer(m, ep) {
    closePlayer();
    const host = document.createElement("div");
    host.id = "anPlayerHost";
    host.innerHTML = playerHTML(m, ep);
    document.body.appendChild(host);
    document.body.classList.add("an-player-open");
    const frame = host.querySelector("iframe");
    if (frame) frame.focus({ preventScroll: true });
  }

  function closePlayer() {
    const host = document.getElementById("anPlayerHost");
    if (host) host.remove();
    document.body.classList.remove("an-player-open");
  }

  /* ---------- events (delegated once) ---------- */

  let wired = false;

  function wire() {
    if (wired) return;
    wired = true;

    document.addEventListener("click", function (e) {
      if (!document.querySelector(".anime")) return;

      const retry = e.target.closest("[data-retry]");
      if (retry) {
        cache.home = null;
        render(document.getElementById("view"));
        return;
      }

      const card = e.target.closest("[data-anime]");
      if (card) {
        location.hash = "#/anime/i/" + card.getAttribute("data-anime");
        return;
      }

      const epEl = e.target.closest("[data-epwatch]");
      if (epEl) {
        const id = location.hash.match(/^#\/anime\/i\/(\d+)/);
        const m = id ? cache.detail[id[1]] : null;
        if (m) openPlayer(m, epEl.getAttribute("data-epwatch") || 1);
        return;
      }

      const srcEl = e.target.closest("[data-source]");
      if (srcEl) {
        localStorage.setItem("se-anime-source", srcEl.getAttribute("data-source"));
        /* capture the playing episode before the overlay is torn down */
        const host = document.getElementById("anPlayerHost");
        let ep = null;
        if (host) {
          const t = host.querySelector(".an-player__title");
          ep = t ? (t.textContent.match(/EP (\d+)/) || [])[1] : null;
        }
        closePlayer();
        const id = location.hash.match(/^#\/anime\/i\/(\d+)/);
        const m = id ? cache.detail[id[1]] : null;
        if (m && ep) openPlayer(m, ep);
        /* refresh chips in the detail view */
        const wrap = document.querySelector(".an-detail .an-mirrors");
        if (wrap) wrap.outerHTML = sourceChips();
        return;
      }

      const closeBtn = e.target.closest("[data-anclose]");
      if (closeBtn) {
        closePlayer();
        return;
      }

      const go = e.target.closest("[data-anime-search]");
      if (go) {
        const input = document.getElementById("anSearch");
        if (input && input.value.trim()) {
          const term = input.value.trim();
          location.hash = "#/anime/s/" + encodeURIComponent(term);
        }
      }
    });

    document.addEventListener("keydown", function (e) {
      if (!document.querySelector(".anime")) return;
      if (e.key === "Escape") {
        const host = document.getElementById("anPlayerHost");
        if (host) {
          closePlayer();
          return;
        }
      }
      if (e.key !== "Enter") return;
      const input = e.target.closest("#anSearch");
      if (input && input.value.trim()) {
        location.hash = "#/anime/s/" + encodeURIComponent(input.value.trim());
      }
    });
  }

  function destroy() {
    token++;
    closePlayer();
  }

  wire();

  return {
    render: render,
    destroy: destroy,
    refresh: refresh
  };
})();
