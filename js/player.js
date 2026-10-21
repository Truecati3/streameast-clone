/* StreamEast clone — watch view, HLS player, chat, related. */
window.SE_PLAYER = (function () {
  "use strict";

  const D = window.SE_DATA;

  let hls = null;
  let video = null;
  let shell = null;
  let current = null;
  let sources = [];
  let sourceIndex = 0;
  let idleTimer = null;
  let chatTimer = null;
  let bound = [];
  let networkRetries = 0;

  const MAX_NETWORK_RETRIES = 3;

  /* ---------- helpers ---------- */

  function on(el, ev, fn, opts) {
    if (!el) return;
    el.addEventListener(ev, fn, opts);
    bound.push([el, ev, fn, opts]);
  }

  function unbindAll() {
    bound.forEach(function (b) {
      b[0].removeEventListener(b[1], b[2], b[3]);
    });
    bound = [];
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtTime(iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const ICONS = {
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
    volume:
      '<path d="M3 9v6h4l5 5V4L7 9H3z"/>' +
      '<path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2"/>',
    muted:
      '<path d="M3 9v6h4l5 5V4L7 9H3z"/>' +
      '<path d="M17 9l4 6M21 9l-4 6" fill="none" stroke="currentColor" stroke-width="2"/>',
    full:
      '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" ' +
      'stroke="currentColor" stroke-width="2"/>'
  };

  function icon(name) {
    return (
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">' +
      ICONS[name] +
      "</svg>"
    );
  }

  function logoHTML(t, size) {
    const img = t.logo
      ? '<img src="' + esc(t.logo) + '" alt="" loading="lazy" onerror="this.remove()">'
      : "";
    return (
      '<span class="logo" style="background:' +
      esc(t.color) +
      (size ? ";width:" + size + "px;height:" + size + "px" : "") +
      '"><span class="logo-abbr">' +
      esc(t.abbr) +
      "</span>" +
      img +
      "</span>"
    );
  }

  function teamLine(t, score) {
    const s =
      score === null || score === undefined || score === ""
        ? t.record
          ? '<span class="team-record">' + esc(t.record) + "</span>"
          : ""
        : '<span class="team-score">' + esc(score) + "</span>";
    return (
      '<div class="team">' +
      logoHTML(t) +
      '<span class="team-name">' +
      esc(t.name) +
      "</span>" +
      s +
      "</div>"
    );
  }

  function relatedHTML(game) {
    const view = document.getElementById("view");
    void view;
    const all = window.SE_APP ? window.SE_APP.games() : [];
    const pool = all.length ? all : [game];
    const same = pool.filter(function (g) { return g.id !== game.id && g.league === game.league; });
    const other = pool.filter(function (g) { return g.id !== game.id && g.league !== game.league; });
    const list = same.concat(other).slice(0, 7);

    if (!list.length) return '<div class="sr-empty">No other events listed.</div>';

    return list
      .map(function (g) {
        return (
          '<button class="rel-item" data-watch="' +
          esc(g.id) +
          '">' +
          logoHTML(g.home, 24) +
          '<span class="rel-info">' +
          '<span class="rel-title">' +
          esc(g.away.name) +
          " vs " +
          esc(g.home.name) +
          "</span>" +
          '<span class="rel-sub">' +
          esc(g.status === "in" ? g.statusLabel : fmtTime(g.start)) +
          " · " +
          esc(D.LEAGUE_NAMES[g.league] || g.league) +
          "</span></span></button>"
        );
      })
      .join("");
  }

  /* ---------- markup ---------- */

  function mount(game) {
    destroy();
    current = game;
    sources = D.sourcesFor(game);
    sourceIndex = 0;
    networkRetries = 0;

    const views = document.getElementById("view");
    const showScore = game.status !== "pre";

    views.innerHTML =
      '<div class="watch">' +
      '<div class="watch-main">' +
      '<div class="player-shell" id="shell">' +
      '<video id="seVideo" playsinline preload="metadata"></video>' +
      '<div class="player-frame" id="frameWrap"><iframe id="seFrame" title="Event stream" ' +
      'allow="autoplay; fullscreen; encrypted-media; picture-in-picture" ' +
      'referrerpolicy="origin"></iframe></div>' +
      '<div class="player-overlay" id="overlay"><div><div class="spinner"></div>Loading…</div></div>' +
      '<div class="player-controls">' +
      '<button class="pc-btn" id="playBtn" aria-label="Play or pause">' +
      icon("pause") +
      "</button>" +
      '<div class="vol-wrap">' +
      '<button class="pc-btn" id="muteBtn" aria-label="Mute">' +
      icon("volume") +
      "</button>" +
      '<input class="vol" id="volRange" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume">' +
      "</div>" +
      (game.status === "in" ? '<span class="live-pill">● LIVE</span>' : "") +
      '<span class="spacer"></span>' +
      '<select class="quality" id="quality" aria-label="Quality"><option value="-1">Auto</option></select>' +
      '<button class="pc-btn" id="fsBtn" aria-label="Fullscreen">' +
      icon("full") +
      "</button>" +
      "</div></div>" +

      '<div class="watch-head">' +
      '<button class="back-btn" id="backBtn">← Back</button>' +
      '<div class="watch-title"><h1>' +
      esc(game.away.name) +
      ' <span class="vs">vs</span> ' +
      esc(game.home.name) +
      "</h1>" +
      '<div class="watch-meta">' +
      "<span>" +
      esc(D.LEAGUE_NAMES[game.league] || game.league) +
      "</span>" +
      '<span class="dot"></span><span>' +
      esc(game.status === "post" ? "Final" : game.status === "in" ? game.statusLabel : fmtTime(game.start)) +
      "</span>" +
      (game.venue ? '<span class="dot"></span><span>' + esc(game.venue) + "</span>" : "") +
      (game.broadcast ? '<span class="dot"></span><span>TV: ' + esc(game.broadcast) + "</span>" : "") +
      "</div></div>" +

      '<div class="watch-scores">' +
      teamLine(game.away, showScore ? game.away.score : null) +
      teamLine(game.home, showScore ? game.home.score : null) +
      "</div>" +
      "</div>" +

      '<div class="sources" id="sourceRow"></div>' +
      "</div>" +

      '<aside class="watch-side">' +
      '<div class="side-tabs">' +
      '<button class="active" data-tab="chat">Chat</button>' +
      '<button data-tab="games">Games</button>' +
      "</div>" +
      '<div class="side-panel active" id="panelChat">' +
      '<div class="chat-log" id="chatLog"></div>' +
      '<form class="chat-form" id="chatForm">' +
      '<input id="chatInput" type="text" maxlength="240" placeholder="Say something…" autocomplete="off" aria-label="Chat message">' +
      '<button type="submit">Send</button>' +
      "</form></div>" +
      '<div class="side-panel" id="panelGames">' +
      '<div class="related-list">' +
      relatedHTML(game) +
      "</div></div>" +
      "</aside></div>";

    shell = document.getElementById("shell");
    video = document.getElementById("seVideo");

    renderSources();
    wireControls();
    wireChat();
    wireTabs();
    wake();
    startSources();
  }

  /* ---------- source start ---------- */

  async function startSources() {
    const game = current;
    if (!game) return;

    setOverlay('<div><div class="spinner"></div>Finding a stream for this game…</div>');

    let found = [];
    try {
      const res = await D.resolveStreams(game);
      found = res.streams || [];
    } catch (_e) {
      found = [];
    }

    // The view may have changed while the lookup was in flight.
    if (!current || current !== game) return;

    if (found.length) {
      sources = found.map(function (s, i) {
        const bits = [s.name || "Stream " + (i + 1)];
        if (s.language) bits.push(s.language);
        if (s.hd) bits.push("HD");
        return { name: bits.join(" · "), embedUrl: s.embedUrl };
      });
      sourceIndex = 0;
      renderSources();
      playSource(0);
      return;
    }

    sources = D.sourcesFor(game);
    sourceIndex = 0;
    renderSources();
    playSource(0);
  }

  /* ---------- sources ---------- */

  function renderSources() {
    const row = document.getElementById("sourceRow");
    if (!row) return;

    const active = sources[sourceIndex] || null;

    row.innerHTML =
      '<span class="label">Streams</span>' +
      (sources.length
        ? sources
            .map(function (s, i) {
              return (
                '<button class="src-btn' +
                (i === sourceIndex ? " active" : "") +
                '" data-src="' +
                i +
                '">' +
                esc(s.name) +
                "</button>"
              );
            })
            .join("")
        : '<span class="src-empty">No stream mapped to this game yet.</span>') +
      '<button class="src-btn add" id="addStreamBtn">+ Add stream</button>' +
      '<button class="src-btn ghost" id="testConnBtn">Test connection</button>' +
      (active && active.embedUrl
        ? '<span class="src-foot">' +
          '<span class="src-note">Embedded player — press play inside the frame if it does not start.</span>' +
          '<a class="src-link" href="' + esc(active.embedUrl) + '" target="_blank" rel="noopener">Open in new tab</a>' +
          "</span>"
        : "");

    row.querySelectorAll("[data-src]").forEach(function (btn) {
      on(btn, "click", function () {
        const idx = Number(btn.getAttribute("data-src"));
        if (idx === sourceIndex) return;
        playSource(idx);
      });
    });

    on(document.getElementById("addStreamBtn"), "click", function () {
      toggleStreamForm(row);
    });

    on(document.getElementById("testConnBtn"), "click", testConnection);
  }

  /* ---------- connection test ---------- */

  function testConnection() {
    const existing = document.getElementById("connPanel");
    if (existing) {
      existing.remove();
      return;
    }

    const row = document.getElementById("sourceRow");
    if (!row) return;

    const box = document.createElement("div");
    box.id = "connPanel";
    box.className = "conn-panel";
    box.textContent = "Testing network…";
    row.appendChild(box);

    const rows = [];
    const paint = function () {
      const el = document.getElementById("connPanel");
      if (!el) return;
      el.innerHTML = rows
        .map(function (r) {
          return (
            '<span class="conn-row"><b>' + esc(r[0]) + "</b> " + esc(r[1]) +
            ' <i>' + esc(r[2]) + "</i></span>"
          );
        })
        .join("");
    };

    const t0 = performance.now();
    fetch("https://streamed.pk/api/matches/all", {
      cache: "no-store",
      headers: { Accept: "application/json" }
    })
      .then(function (r) {
        rows.push(["Match API", r.ok ? "reachable" : "HTTP " + r.status, Math.round(performance.now() - t0) + "ms"]);
      })
      .catch(function () {
        rows.push(["Match API", "blocked", Math.round(performance.now() - t0) + "ms"]);
      })
      .then(function () {
        paint();
        const src = sources[sourceIndex];
        if (!src || !src.embedUrl) {
          rows.push(["Player host", "n/a (direct HLS source)", "—"]);
          paint();
          return;
        }

        const probe = document.createElement("iframe");
        probe.style.cssText = "position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none";
        probe.src = src.embedUrl;

        let done = false;
        const start = performance.now();
        const finish = function (label) {
          if (done) return;
          done = true;
          rows.push(["Player host", label, Math.round(performance.now() - start) + "ms"]);
          paint();
          probe.remove();
        };

        probe.addEventListener("load", function () { finish("reachable"); });
        document.body.appendChild(probe);
        setTimeout(function () { finish("no response after 8s"); }, 8000);
      });
  }

  function toggleStreamForm(row) {
    const existing = document.getElementById("streamForm");
    if (existing) {
      existing.remove();
      return;
    }

    const form = document.createElement("form");
    form.id = "streamForm";
    form.className = "stream-form";
    form.innerHTML =
      '<input id="streamUrl" type="url" placeholder="https://…/stream.m3u8" ' +
      'aria-label="Stream URL" spellcheck="false">' +
      '<button type="submit">Play</button>' +
      (D.getCustomStream(current.id) ? '<button type="button" id="clearStream">Clear</button>' : "");

    row.appendChild(form);
    const input = form.querySelector("#streamUrl");
    input.focus();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      const url = input.value.trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) {
        input.value = "";
        input.placeholder = "Needs an http(s) URL";
        return;
      }
      D.setCustomStream(current.id, url);
      sources = D.sourcesFor(current);
      sourceIndex = 0;
      form.remove();
      renderSources();
      playSource(0);
    });

    const clear = form.querySelector("#clearStream");
    if (clear) {
      clear.addEventListener("click", function () {
        D.setCustomStream(current.id, "");
        sources = D.sourcesFor(current);
        sourceIndex = 0;
        form.remove();
        renderSources();
        loadSource(0);
      });
    }
  }

  /* ---------- playback ---------- */

  function setOverlay(html) {
    const overlay = document.getElementById("overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    overlay.innerHTML = html;
  }

  function hideOverlay() {
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.classList.add("hidden");
  }

  function showError(msg) {
    setOverlay(
      '<div><div class="err">' +
        esc(msg) +
        '</div><button class="btn-watch" id="retryBtn" style="margin-top:14px">Retry</button></div>'
    );
    on(document.getElementById("retryBtn"), "click", function () {
      playSource(sourceIndex);
    });
  }

  function tryPlay() {
    const p = video.play();
    if (!p || !p.catch) return;
    p.then(hideOverlay).catch(function () {
      video.muted = true;
      syncVolumeUI();
      video
        .play()
        .then(hideOverlay)
        .catch(function () {
          setOverlay(
            '<div><button class="pc-btn" id="tapPlay" style="transform:scale(2.2)" aria-label="Play">' +
              icon("play") +
              "</button></div>"
          );
          on(document.getElementById("tapPlay"), "click", function () {
            hideOverlay();
            video.play().catch(function () {});
          });
        });
    });
  }

  function buildQuality() {
    const sel = document.getElementById("quality");
    if (!sel || !hls || !hls.levels) return;
    const options = ['<option value="-1">Auto</option>'];
    hls.levels.forEach(function (level, i) {
      const label = level.height ? level.height + "p" : Math.round(level.bitrate / 1000) + "k";
      options.push('<option value="' + i + '">' + label + "</option>");
    });
    sel.innerHTML = options.join("");
  }

  function playSource(index) {
    const src = sources[index];
    if (!src || !current) return;
    sourceIndex = index;
    networkRetries = 0;

    document.querySelectorAll(".src-btn[data-src]").forEach(function (b) {
      b.classList.toggle("active", Number(b.getAttribute("data-src")) === index);
    });

    if (src.embedUrl) loadEmbed(src);
    else loadHls(src);
  }

  function loadEmbed(src) {
    if (hls) {
      hls.destroy();
      hls = null;
    }
    if (video) {
      try {
        video.pause();
      } catch (_e) { /* detached */ }
      video.removeAttribute("src");
      video.load();
    }

    const frame = document.getElementById("seFrame");
    if (!frame || !shell) return;

    shell.classList.add("embed");
    hideOverlay();
    frame.src = src.embedUrl;
  }

  function loadHls(src) {
    if (!video) return;

    if (shell) shell.classList.remove("embed");
    const frame = document.getElementById("seFrame");
    if (frame) frame.src = "about:blank";

    setOverlay('<div><div class="spinner"></div>Connecting to ' + esc(src.name) + "…</div>");

    if (hls) {
      hls.destroy();
      hls = null;
    }
    video.removeAttribute("src");
    video.load();

    if (window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });

      hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
        buildQuality();
        tryPlay();
      });

      hls.on(window.Hls.Events.ERROR, function (_evt, data) {
        if (!data.fatal) return;
        if (
          data.type === window.Hls.ErrorTypes.NETWORK_ERROR &&
          networkRetries < MAX_NETWORK_RETRIES
        ) {
          networkRetries += 1;
          hls.startLoad();
          return;
        }
        if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
          return;
        }
        showError('"' + src.name + '" is not responding. Try another stream or add your own.');
      });

      hls.loadSource(src.url);
      hls.attachMedia(video);
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src.url;
      on(video, "loadedmetadata", tryPlay, { once: true });
      on(video, "error", function () {
        showError('"' + src.name + '" is not responding. Try another stream.');
      });
      return;
    }

    showError("HLS playback is not supported in this browser.");
  }

  /* ---------- controls ---------- */

  function syncPlayIcon() {
    const btn = document.getElementById("playBtn");
    if (btn) btn.innerHTML = icon(video.paused ? "play" : "pause");
  }

  function syncVolumeUI() {
    const muteBtn = document.getElementById("muteBtn");
    const range = document.getElementById("volRange");
    if (muteBtn) muteBtn.innerHTML = icon(video.muted ? "muted" : "volume");
    if (range) range.value = video.muted ? 0 : video.volume;
  }

  function wake() {
    if (!shell) return;
    shell.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (video && !video.paused) shell.classList.add("idle");
    }, 2600);
  }

  function wireControls() {
    const playBtn = document.getElementById("playBtn");
    const muteBtn = document.getElementById("muteBtn");
    const volRange = document.getElementById("volRange");
    const fsBtn = document.getElementById("fsBtn");
    const quality = document.getElementById("quality");
    const backBtn = document.getElementById("backBtn");

    on(playBtn, "click", function () {
      if (video.paused) video.play().catch(function () {});
      else video.pause();
    });

    on(video, "play", syncPlayIcon);
    on(video, "pause", syncPlayIcon);
    on(video, "volumechange", syncVolumeUI);
    on(video, "playing", hideOverlay);

    on(muteBtn, "click", function () {
      video.muted = !video.muted;
      syncVolumeUI();
    });

    on(volRange, "input", function () {
      const v = Number(volRange.value);
      video.volume = v;
      video.muted = v === 0;
      syncVolumeUI();
    });

    on(fsBtn, "click", function () {
      if (!document.fullscreenElement) shell.requestFullscreen().catch(function () {});
      else document.exitFullscreen().catch(function () {});
    });

    on(quality, "change", function () {
      if (!hls) return;
      const v = Number(quality.value);
      hls.currentLevel = v;
      if (v === -1) hls.nextLevel = -1;
    });

    on(backBtn, "click", function () {
      location.hash = "#/";
    });

    on(shell, "mousemove", wake);
    on(shell, "touchstart", wake, { passive: true });
    on(shell, "mouseleave", function () {
      if (video && !video.paused) shell.classList.add("idle");
    });

    on(document, "keydown", function (e) {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (video.paused) video.play().catch(function () {});
        else video.pause();
      } else if (e.key === "m" || e.key === "M") {
        video.muted = !video.muted;
        syncVolumeUI();
      } else if (e.key === "f" || e.key === "F") {
        if (!document.fullscreenElement) shell.requestFullscreen().catch(function () {});
        else document.exitFullscreen().catch(function () {});
      }
    });

    syncPlayIcon();
    syncVolumeUI();
  }

  /* ---------- sidebar ---------- */

  const CHAT_USERS = [
    "hoopsjunkie", "westside11", "couchcoach", "tatersalad", "dmv_tony",
    "lakeshow", "frontrow_kat", "sunday_irish", "rooftopkid", "bigplayray",
    "shotclock", "coldbrew", "varsityblues", "northside", "jules99"
  ];

  const CHAT_LINES = [
    "this ref is blind fr",
    "who's got a good stream, mine keeps buffering",
    "WHAT A PLAY",
    "feed is clean tonight",
    "my parlay is sweating",
    "defense asleep again",
    "chat is moving fast lol",
    "called it",
    "no way he missed that",
    "4th quarter about to be crazy",
    "anyone else lagging?",
    "the other stream is smoother for me",
    "bench player carried that quarter",
    "told yall they were cooked",
    "LETS GOOO",
    "clock management is terrible",
    "that was a foul 100%",
    "who else watching from work",
    "ot incoming",
    "crowd is loud tonight"
  ];

  function nameColor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return "hsl(" + h + ", 62%, 66%)";
  }

  function appendChat(name, text, kind) {
    const log = document.getElementById("chatLog");
    if (!log) return;

    const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
    const div = document.createElement("div");
    div.className = "msg" + (kind ? " " + kind : "");

    if (kind === "sys") {
      div.textContent = text;
    } else {
      const who = document.createElement("span");
      who.className = "who";
      who.style.color = kind === "mine" ? "#6fd3a0" : nameColor(name);
      who.textContent = name + ": ";
      div.appendChild(who);
      div.appendChild(document.createTextNode(text));
    }

    log.appendChild(div);

    // Bound the log so a long session doesn't grow without limit.
    while (log.childNodes.length > 250) log.removeChild(log.firstChild);

    if (atBottom) log.scrollTop = log.scrollHeight;
  }

  let chatSeq = 0;

  function startChat() {
    appendChat(null, "Match chat. Keep it civil.", "sys");

    for (let i = 0; i < 6; i++) {
      chatSeq += 1;
      appendChat(
        CHAT_USERS[chatSeq % CHAT_USERS.length],
        CHAT_LINES[(chatSeq * 7) % CHAT_LINES.length]
      );
    }

    chatTimer = setInterval(function () {
      if (document.hidden) return;
      chatSeq += 1;
      appendChat(
        CHAT_USERS[Math.floor(Math.random() * CHAT_USERS.length)],
        CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)]
      );
    }, 3200);
  }

  function wireChat() {
    const form = document.getElementById("chatForm");
    const input = document.getElementById("chatInput");
    if (!form || !input) return;

    startChat();

    on(form, "submit", function (e) {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      appendChat("you", text, "mine");
      input.value = "";
    });
  }

  function wireTabs() {
    const tabs = document.querySelectorAll(".side-tabs button");
    const chat = document.getElementById("panelChat");
    const games = document.getElementById("panelGames");

    tabs.forEach(function (btn) {
      on(btn, "click", function () {
        const isChat = btn.getAttribute("data-tab") === "chat";
        tabs.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        chat.classList.toggle("active", isChat);
        games.classList.toggle("active", !isChat);
      });
    });
  }

  /* ---------- teardown ---------- */

  function destroy() {
    clearTimeout(idleTimer);
    clearInterval(chatTimer);
    idleTimer = null;
    chatTimer = null;

    unbindAll();

    if (hls) {
      hls.destroy();
      hls = null;
    }
    if (video) {
      try {
        video.pause();
      } catch (_e) { /* already detached */ }
      video.removeAttribute("src");
      video.load();
    }

    video = null;
    shell = null;
    current = null;
    sources = [];
  }

  return {
    mount: mount,
    destroy: destroy
  };
})();
