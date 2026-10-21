/* GZME — browser console. Every title is a real archive.org in-browser
   emulation, launched in an iframe. No invented entries. */
window.SE_GZME = (function () {
  "use strict";

  const EMBED = "https://archive.org/embed/";

  /* Browser ports, verified live at build time: HTTP 200 and no framing block.
     "link" entries ship an X-Frame-Options/CSP block, so they open in a tab. */
  const PORTS = [
    { id: "port-bo1", title: "Black Ops: Zombies", year: 2010, platform: "Web", genre: "Ports", mode: "embed", url: "https://vel.gg/bolz", art: ["#6b1a1a", "#160505"] },
    { id: "port-gta-vc", title: "GTA: Vice City", year: 2002, platform: "Web", genre: "Ports", mode: "embed", url: "https://joncodeofficial.github.io/gta-vice-city-wasm/", art: ["#7a1f4a", "#1a0512"], note: "bring your own game files" },
    { id: "port-halo", title: "Halo: Combat Evolved", year: 2001, platform: "Web", genre: "Ports", mode: "embed", url: "https://mitchellhynes.com/halo", art: ["#1f4a5a", "#06121a"] },
    { id: "port-halo-mobile", title: "Halo CE — Mobile", year: 2001, platform: "Web", genre: "Ports", mode: "embed", url: "https://hcemobile.com", art: ["#2a4a6b", "#08131c"] },
    { id: "port-simpsons", title: "The Simpsons: Hit & Run", year: 2003, platform: "Web", genre: "Ports", mode: "embed", url: "https://shar-wasm.cjoseph.workers.dev", art: ["#6b5a0f", "#161304"] },
    { id: "port-pes6", title: "Pro Evolution Soccer 6", year: 2006, platform: "Web", genre: "Ports", mode: "embed", url: "https://pes6.optijuegos.net", art: ["#1f5a2a", "#04120a"] },
    { id: "port-surf", title: "Surfd — CS Surf", year: 2024, platform: "Web", genre: "Ports", mode: "embed", url: "https://surfd.net", art: ["#2a5a6b", "#08161c"] },
    { id: "port-q2", title: "Quake II", year: 1997, platform: "Web", genre: "Ports", mode: "embed", url: "https://q2.pieter.com", art: ["#5c3a1e", "#0b0805"] },
    { id: "port-q3", title: "Quake III Arena", year: 1999, platform: "Web", genre: "Ports", mode: "embed", url: "https://q3.pieter.com", art: ["#6b2a10", "#160803"] },
    { id: "port-rtcw", title: "Return to Castle Wolfenstein", year: 2001, platform: "Web", genre: "Ports", mode: "embed", url: "https://rtcw.pieter.com", art: ["#3a3a4a", "#0b0b10"] },
    { id: "port-urban-terror", title: "Urban Terror", year: 2000, platform: "Web", genre: "Ports", mode: "embed", url: "https://ut.pieter.com", art: ["#4a3a1a", "#120d04"] },
    { id: "port-skate-rust", title: "Skate Rust", year: 2025, platform: "Web", genre: "Ports", mode: "link", url: "https://global-terror.net", art: ["#5a2a1a", "#140804"] },
    { id: "port-minecraft", title: "Minecraft", year: 2011, platform: "Web", genre: "Ports", mode: "link", url: "https://wasmarcade.com/minecraft", art: ["#2a5a1f", "#081206"] }
  ];


  /* art: two-stop gradient used as the tile artwork. */
  const GAMES = [
    { id: "doomII", title: "Doom II", year: 1994, platform: "DOS", genre: "Shooters", art: ["#8f2410", "#260604"] },
    { id: "Wolf3d-sw1", title: "Wolfenstein 3D", year: 1992, platform: "DOS", genre: "Shooters", art: ["#2f4f7a", "#0a1220"] },
    { id: "3dduke13SW", title: "Duke Nukem 3D", year: 1996, platform: "DOS", genre: "Shooters", art: ["#a3320f", "#1a0d05"] },
    { id: "msdos_Heretic_1994", title: "Heretic", year: 1994, platform: "DOS", genre: "Shooters", art: ["#4a2b6b", "#0d0716"] },
    { id: "QUAKE_201806", title: "Quake", year: 1996, platform: "DOS", genre: "Shooters", art: ["#5c3a1e", "#0b0805"] },
    { id: "msdos_Descent_II_Vertigo_Series_1996", title: "Descent II", year: 1996, platform: "DOS", genre: "Shooters", art: ["#0f3f4a", "#04121a"] },
    { id: "msdos_Tyrian_2000_1999", title: "Tyrian 2000", year: 1999, platform: "DOS", genre: "Shooters", art: ["#1b2a7a", "#050818"] },

    { id: "msdos_Mortal_Kombat_1993", title: "Mortal Kombat", year: 1993, platform: "DOS", genre: "Fighters", art: ["#7a0f18", "#150305"] },
    { id: "SSF2_DOS", title: "Super Street Fighter II Turbo", year: 1994, platform: "DOS", genre: "Fighters", art: ["#a8790c", "#1a1203"] },
    { id: "Golden_Axe_III_J_f2", title: "Golden Axe III", year: 1993, platform: "Genesis", genre: "Fighters", art: ["#6b3a0f", "#170c03"] },

    { id: "MONKEY_VGA", title: "The Secret of Monkey Island", year: 1990, platform: "DOS", genre: "Adventure", art: ["#1f5a4a", "#04120f"] },
    { id: "msdos_Full_Throttle_1995", title: "Full Throttle", year: 1995, platform: "DOS", genre: "Adventure", art: ["#6b2a10", "#160803"] },
    { id: "ARENA_201902", title: "The Elder Scrolls: Arena", year: 1994, platform: "DOS", genre: "Adventure", art: ["#3a2a55", "#0a0714"] },
    { id: "prince_of_persia_1990", title: "Prince of Persia", year: 1990, platform: "DOS", genre: "Adventure", art: ["#4a3418", "#100b04"] },

    { id: "msdos_SimCity_1989", title: "SimCity", year: 1989, platform: "DOS", genre: "Strategy", art: ["#175066", "#04121a"] },
    { id: "CIVILIZATION_201902", title: "Sid Meier's Civilization", year: 1991, platform: "DOS", genre: "Strategy", art: ["#2b4a2b", "#08130a"] },
    { id: "msdos_Transport_Tycoon_Deluxe_1995", title: "Transport Tycoon Deluxe", year: 1995, platform: "DOS", genre: "Strategy", art: ["#2a4a6b", "#07121c"] },
    { id: "msdos_Master_of_Orion_1993", title: "Master of Orion", year: 1993, platform: "DOS", genre: "Strategy", art: ["#1a1f4a", "#05060f"] },
    { id: "msdos_Syndicate_Plus_1994", title: "Syndicate Plus", year: 1994, platform: "DOS", genre: "Strategy", art: ["#3f2a4a", "#0b0710"] },
    { id: "warcraft-2", title: "Warcraft II", year: 1995, platform: "DOS", genre: "Strategy", art: ["#5a1f14", "#120503"] },

    { id: "Super_Mario_Bros_OK", title: "Super Mario Bros.", year: 1985, platform: "NES", genre: "Console", art: ["#1a4fa8", "#061024"] },
    { id: "dkc_snes_2", title: "Donkey Kong Country", year: 1994, platform: "SNES", genre: "Console", art: ["#5c3a10", "#140c03"] },
    { id: "classic-nes-series-the-legend-of-zelda-usa-europe_202512", title: "The Legend of Zelda", year: 1986, platform: "NES", genre: "Console", art: ["#2a5a2a", "#07130a"] },
    { id: "pokemon_red_enhanced", title: "Pokémon Red", year: 1996, platform: "Game Boy", genre: "Console", art: ["#8f1a1a", "#1a0505"] },
    { id: "Sonic_the_hedgehog_Egg_Blaster", title: "Sonic the Hedgehog", year: 1991, platform: "Genesis", genre: "Console", art: ["#0f3fa8", "#040c1c"] },
    { id: "contra-the-alien-wars", title: "Contra: The Alien Wars", year: 1992, platform: "SNES", genre: "Console", art: ["#6b1a3a", "#16050d"] },

    { id: "KEEN_EGA", title: "Commander Keen", year: 1990, platform: "DOS", genre: "Classics", art: ["#1f4a6b", "#06121a"] },
    { id: "LEMMING_CGA", title: "Lemmings", year: 1991, platform: "DOS", genre: "Classics", art: ["#2a6b4a", "#08160f"] },
    { id: "msdos_Jazz_Jackrabbit_-_Holiday_Hare_1994_1994", title: "Jazz Jackrabbit", year: 1994, platform: "DOS", genre: "Classics", art: ["#4a6b1a", "#0f1604"] },
    { id: "OREDX_VGA", title: "The Oregon Trail Deluxe", year: 1992, platform: "DOS", genre: "Classics", art: ["#6b5a1a", "#161304"] }
  ];

  const ROWS = ["Ports", "Shooters", "Fighters", "Adventure", "Strategy", "Console", "Classics"];
  const FEATURED = "port-bo1";

  function all() {
    return PORTS.concat(GAMES);
  }

  function byId(id) {
    return all().find(function (g) { return g.id === id; });
  }

  let launchEl = null;
  let tiles = [];
  let focusIndex = 0;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function art(g) {
    return (
      "linear-gradient(135deg," + g.art[0] + " 0%," + g.art[1] + " 100%)"
    );
  }

  function url(g) {
    return g.url ? g.url : EMBED + g.id;
  }

  function tile(g) {
    const link = g.mode === "link";
    return (
      '<button class="gz-tile" data-game="' + esc(g.id) + '" style="--art:' + art(g) + '"' +
      ' aria-label="Play ' + esc(g.title) + '">' +
      '<span class="gz-tile__badge">' + esc(g.platform) + (link ? " ↗" : "") + "</span>" +
      '<span class="gz-tile__name">' + esc(g.title) + "</span>" +
      '<span class="gz-tile__sub">' + g.year + " · " +
      (link ? "opens in tab" : g.note ? esc(g.note) : g.genre === "Ports" ? "runs in frame" : esc(g.genre)) +
      "</span>" +
      "</button>"
    );
  }

  function hero() {
    const g = byId(FEATURED);
    const link = g.mode === "link";
    return (
      '<section class="gz-hero">' +
      '<div class="gz-hero__art" style="--art:' + art(g) + '"></div>' +
      '<div class="gz-hero__body">' +
      '<span class="gz-eyebrow"><b>Play now</b> ' +
      (link ? "Opens in a new tab" : "No install · runs in the frame") + "</span>" +
      '<h1 class="gz-hero__title">' + esc(g.title) + "</h1>" +
      '<div class="gz-hero__meta">' +
      "<span>" + g.year + "</span><span class=\"sep\"></span>" +
      "<span>" + esc(g.platform) + "</span><span class=\"sep\"></span>" +
      "<span>" + esc(g.genre) + "</span><span class=\"sep\"></span>" +
      "<span>" + all().length + " titles docked</span>" +
      "</div>" +
      '<button class="gz-play" data-game="' + esc(g.id) + '">' +
      '<span class="glyph">✕</span> Play</button>' +
      "</div></section>"
    );
  }

  function row(name) {
    const list = all().filter(function (g) { return g.genre === name; });
    if (!list.length) return "";
    return (
      '<section class="gz-row">' +
      '<div class="gz-row__head">' +
      '<h2 class="gz-row__title">' + esc(name) + "</h2>" +
      '<span class="gz-row__count">' + list.length + " titles</span>" +
      "</div>" +
      '<div class="gz-shelf">' + list.map(tile).join("") + "</div>" +
      "</section>"
    );
  }

  function bar() {
    return (
      '<div class="gz-bar">' +
      '<span class="gz-hint"><span class="glyph">✕</span> Play</span>' +
      '<span class="gz-hint"><span class="glyph">○</span> Back</span>' +
      '<span class="gz-hint"><span class="glyph">←→</span> Browse</span>' +
      '<span class="gz-hint"><span class="glyph">F</span> Fullscreen</span>' +
      '<span class="gz-hint"><span class="glyph">esc</span> Exit</span>' +
      '<span class="gz-bar__spacer"></span>' +
      '<span class="gz-bar__status">Archive.org emulation · keyboard + gamepad</span>' +
      "</div>"
    );
  }

  let clockTimer = null;

  function tick() {
    const el = document.getElementById("gzClock");
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  /* One timer for the page lifetime: render() re-arms it, destroy() clears it. */
  function startClock() {
    clearInterval(clockTimer);
    tick();
    clockTimer = setInterval(tick, 15000);
  }

  function stopClock() {
    clearInterval(clockTimer);
    clockTimer = null;
  }

  function render(view) {
    view.innerHTML =
      '<div class="gzme">' +
      '<div class="gz-top">' +
      '<span class="gz-logo"><i></i>GZME</span>' +
      '<div class="gz-top__meta">' +
      '<span class="gz-user"><img data-pfp src="assets/pfp.svg" alt=""><span>@1387</span></span>' +
      '<span class="gz-clock" id="gzClock"></span>' +
      "</div></div>" +
      hero() +
      ROWS.map(row).join("") +
      bar() +
      "</div>";

    tiles = Array.prototype.slice.call(view.querySelectorAll(".gz-tile"));
    focusIndex = 0;
    startClock();
    document.title = "GZME — Browser Console";
    if (window.SE_HUB && SE_HUB.upgradePfp) SE_HUB.upgradePfp();
    bind(view);
  }

  /* ---------- interaction ---------- */

  function focusTile(i) {
    if (!tiles.length) return;
    focusIndex = (i + tiles.length) % tiles.length;
    tiles.forEach(function (t) { t.classList.remove("focused"); });
    const el = tiles[focusIndex];
    el.classList.add("focused");
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }

  function launch(game) {
    if (!game) return;

    /* Sites that send X-Frame-Options or frame-ancestors can't be framed. */
    if (game.mode === "link") {
      window.open(game.url, "_blank", "noopener");
      return;
    }

    closeLaunch();

    launchEl = document.createElement("div");
    launchEl.className = "gz-launch";
    launchEl.innerHTML =
      '<div class="gz-launch__bar">' +
      '<span class="gz-launch__title">' + esc(game.title) + "</span>" +
      '<span class="gz-launch__meta">' + game.year + " · " + esc(game.platform) + "</span>" +
      '<button class="gz-launch__fs" type="button" title="Toggle fullscreen (F)">' +
      '<span class="glyph">F</span> Fullscreen</button>' +
      '<button class="gz-launch__exit" type="button"><span class="glyph">esc</span> Exit</button>' +
      "</div>" +
      '<div class="gz-launch__frame"><iframe title="' + esc(game.title) + '" ' +
      'src="' + esc(url(game)) + '" allow="autoplay; fullscreen; gamepad" ' +
      'referrerpolicy="origin" allowfullscreen></iframe></div>' +
      '<div class="gz-launch__note">Click the frame once to give it focus. ' +
      "F toggles fullscreen · Esc exits. Sound comes from the game, not this page.</div>";

    document.body.appendChild(launchEl);
    document.body.style.overflow = "hidden";

    launchEl
      .querySelector(".gz-launch__exit")
      .addEventListener("click", closeLaunch);
    launchEl
      .querySelector(".gz-launch__fs")
      .addEventListener("click", toggleFullscreen);

    /* The click that opened the overlay is the gesture; grab the screen. */
    requestFullscreen(launchEl);
  }

  function requestFullscreen(el) {
    if (!el || !el.requestFullscreen) return;
    const p = el.requestFullscreen({ navigationUI: "hide" });
    if (p && p.catch) p.catch(function () {});
  }

  function toggleFullscreen() {
    if (!launchEl) return;
    if (document.fullscreenElement) {
      const p = document.exitFullscreen();
      if (p && p.catch) p.catch(function () {});
      return;
    }
    requestFullscreen(launchEl);
  }

  function closeLaunch() {
    if (!launchEl) return;
    if (document.fullscreenElement) {
      const p = document.exitFullscreen();
      if (p && p.catch) p.catch(function () {});
    }
    launchEl.remove();
    launchEl = null;
    document.body.style.overflow = "";
  }

  function bind(view) {
    initDelegation(view);
  }

  let delegationReady = false;

  /* Delegated once per page: view nodes are replaced on every route change. */
  function initDelegation() {
    if (delegationReady) return;
    delegationReady = true;

    document.addEventListener("click", function (e) {
      if (!document.querySelector(".gzme")) return;
      const el = e.target.closest("[data-game]");
      if (!el) return;
      launch(byId(el.getAttribute("data-game")));
    });

    document.addEventListener("focusin", function (e) {
      if (!document.querySelector(".gzme")) return;
      const el = e.target.closest(".gz-tile");
      if (!el) return;
      const i = tiles.indexOf(el);
      if (i >= 0 && i !== focusIndex) {
        if (tiles[focusIndex]) tiles[focusIndex].classList.remove("focused");
        focusIndex = i;
        el.classList.add("focused");
      }
    });

    document.addEventListener("keydown", function (e) {
      if (!document.querySelector(".gzme")) return;

      if (launchEl) {
        if (e.key === "Escape") {
          /* The browser eats the first Esc to leave fullscreen; the next one exits. */
          if (!document.fullscreenElement) {
            e.preventDefault();
            closeLaunch();
          }
          return;
        }
        if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          toggleFullscreen();
        }
        return;
      }

      if (e.key === "Escape") return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        focusTile(focusIndex + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        focusTile(focusIndex - 1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        focusTile(focusIndex + 5);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        focusTile(focusIndex - 5);
      } else if (e.key === "Enter" && document.activeElement === document.body) {
        e.preventDefault();
        focusTile(focusIndex);
      }
    });
  }

  function destroy() {
    closeLaunch();
    stopClock();
    tiles = [];
    focusIndex = 0;
  }

  return {
    render: render,
    destroy: destroy,
    games: function () { return GAMES.slice(); }
  };
})();
