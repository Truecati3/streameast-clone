/* ANIME playback sources.
   Each entry embeds a watch-page URL inside the in-page player.

   Shape:
     {
       id: "short-stable-id",        // stored in localStorage on switch
       label: "Shown on the chip",   // chip text in the player bar
       url: "https://host/embed/{id}/{ep}"  // {id}=AniList id, {ep}=episode
     }

   Requirements for a source to work here:
   - It must render inside an iframe. Hosts that send X-Frame-Options:
     SAMEORIGIN/DENY or a frame-ancestors CSP render as a blank frame —
     the player says so and offers the next chip. Verify a source frames
     before adding it.
   - {id} is the AniList media id. Only use providers that accept AniList
     ids directly, or wrap the URL in your own resolver on a domain you
     control; this site never proxies or re-hosts media (see AGENTS.md).

   The viewer's choice persists in localStorage key "se-anime-source".
*/
window.SE_ANIME_SOURCES = [];
