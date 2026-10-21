/* Mothership — the hub view. Static dock; no network calls. */
window.SE_HUB = (function () {
  "use strict";

  const DISCORD = "https://discord.com/users/1387";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function pfp(size) {
    return (
      '<img data-pfp src="assets/pfp.svg" alt="" width="' + size + '" height="' + size + '">'
    );
  }

  /* A real photo dropped at assets/pfp.png takes over from the fallback mark. */
  function upgradePfp() {
    const probe = new Image();
    probe.onload = function () {
      const nodes = document.querySelectorAll("[data-pfp]");
      for (let i = 0; i < nodes.length; i++) nodes[i].src = "assets/pfp.png";
    };
    probe.src = "assets/pfp.png";
  }

  function hero() {
    return (
      '<section class="hub-hero">' +
      '<div class="hub-hero__field"></div>' +
      '<div class="hub-hero__grain"></div>' +

      '<div class="hub-hero__top">' +
      "<span><b>Mothership</b> — dock 01</span>" +
      "<span>Two bays open</span>" +
      "</div>" +

      '<div class="hub-hero__mid">' +
      '<span class="hub-kicker">Live sports · browser games</span>' +
      '<h1 class="hub-title">Every <em>door</em><br>in one hull.</h1>' +
      '<p class="hub-sub">StreamEast runs the scoreboard. GZME runs the arcade. ' +
      "Pick a bay, the dock stays behind you.</p>" +
      "</div>" +

      '<div class="hub-hero__bottom">' +
      '<span class="hub-scroll">Scroll to dock</span>' +
      "<span>Built static · zero build step</span>" +
      "</div>" +
      "</section>"
    );
  }

  function dock() {
    return (
      '<section class="hub-dock">' +
      '<div class="hub-label"><span>Docks</span><span>02 online · 01 reserved</span></div>' +
      '<div class="dock-grid">' +

      '<a class="dock-card dock-card--stream" href="#/stream">' +
      '<div class="dock-head"><span>Bay 01</span><span class="dock-pill dock-pill--live">Live</span></div>' +
      '<div class="dock-body">' +
      '<h2 class="dock-name">StreamEast</h2>' +
      '<p class="dock-desc">Live scoreboard from ESPN, per-event streams, ' +
      "source switching, HLS fallback.</p>" +
      '<span class="dock-go"><i></i>Enter bay</span>' +
      "</div></a>" +

      '<a class="dock-card dock-card--gzme" href="#/gzme">' +
      '<div class="dock-head"><span>Bay 02</span><span class="dock-pill">43 titles</span></div>' +
      '<div class="dock-body">' +
      '<h2 class="dock-name">GZME</h2>' +
      '<p class="dock-desc">Browser console. Black Ops Zombies, Halo, Quake III, ' +
      "Monkey Island and more — launched fullscreen in place.</p>" +
      '<span class="dock-go"><i></i>Enter bay</span>' +
      "</div></a>" +

      '<div class="dock-card dock-card--soon">' +
      '<div class="dock-head"><span>Bay 03</span><span class="dock-pill">Reserved</span></div>' +
      '<div class="dock-body">' +
      '<h2 class="dock-name">Empty hull</h2>' +
      '<p class="dock-desc">Next bay is unassigned. Drop a route in ' +
      "js/app.js and it docks here.</p>" +
      "</div></div>" +

      "</div></section>"
    );
  }

  function contact() {
    return (
      '<section class="hub-contact">' +
      '<div class="hub-sign" aria-hidden="true">/*</div>' +
      '<div class="hub-connect">' +
      '<p class="hub-connect__text">Mothership exists for people who want ' +
      "the scoreboard <em>and</em> the arcade without six tabs.</p>" +
      '<a class="hub-disc" href="' + DISCORD + '" target="_blank" rel="noopener">' +
      pfp(52) +
      '<span class="hub-disc__meta"><b>@1387</b><span>Discord — say something</span></span>' +
      "</a>" +
      "</div></section>" +

      '<div class="hub-foot">' +
      "<span>© Mothership 2026</span>" +
      "<span>StreamEast · GZME</span>" +
      '<a href="https://github.com/Truecati3/streameast-clone" target="_blank" rel="noopener">Source</a>' +
      "</div>"
    );
  }

  function render(view) {
    view.innerHTML = hero() + dock() + contact();
    document.title = "Mothership";
    upgradePfp();
  }

  return { render: render, discord: DISCORD, upgradePfp: upgradePfp };
})();
