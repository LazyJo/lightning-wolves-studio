/* JAVEDA - the app on a phone, also offline.
   Only the JAVEDA pages (scope /javeda/). The rest of lightningwolves.studio has no service worker.
   - The pages and scripts here: from the network when there is one (so an update shows at once), else the saved copy.
   - three.js, the Supabase library and the fonts: saved the first time, then from the phone.
   - The songs (Supabase Storage): saved the first time a level plays one (or all at once, from the page), then
     played from the phone - with the byte ranges an iPhone asks for, or it won't play them.
   - The scoreboard, log-in and saving runs (Supabase) always go to the network: never a stale copy. */
const V = "javeda-v1";
const PAGES = V + "-pages", LIBS = "javeda-libs-v1", SONGS = "javeda-songs-v1";
const SONG_RE = /\/storage\/v1\/object\/public\/media\/javeda\/[^/?]+\.mp3$/;
const LIB_RE = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

// everything a level needs, saved when the app is put on the phone (about 3 MB)
const LEVELS = ["be-alright", "blind-love", "down-for-me", "fall-in-love-again", "feel-like-that", "ghost", "go", "going-crazy",
  "hyperdrive", "im-lost", "issues", "journey", "la-night", "la-vibe", "lifestyle-crazy", "my-heart", "myself", "need-more-time",
  "no-rest-no-work", "oublie-moi", "peace-inside", "real-love", "rollercoaster", "somebody", "space-kid", "stay-up-2", "stay-up",
  "true-fighter", "you-ready", "zirkas-ride"];
const AVATARS = ["saucer"];
const SHELL = ["./", "i18n.js", "i18n-levels.js", "touch.js", "sound.js", "manifest.webmanifest", "icons/icon-any-192.png", "icons/apple-touch-icon.png",
  ...AVATARS.map(a => "avatars/" + a + ".svg"), ...LEVELS.map(l => "levels/" + l + ".html")];
const LIBS_FIRST = ["https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(PAGES);
    // one by one, so a single missing file doesn't stop the rest
    await Promise.all(SHELL.map(u => c.add(new Request(u, { cache:"reload" })).catch(() => {})));
    const l = await caches.open(LIBS);
    await Promise.all(LIBS_FIRST.map(async u => { if (!(await l.match(u))) await l.add(new Request(u, { mode:"cors" })).catch(() => {}); }));
    self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("javeda-v") && k !== V && !k.startsWith(V + "-")) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (SONG_RE.test(url.pathname) && url.hostname.endsWith(".supabase.co")) return e.respondWith(song(e));
  if (url.hostname.endsWith(".supabase.co")) return;                       // the database, log-in, the lobby: live only
  if (LIB_RE.test(req.url)) return e.respondWith(lib(req));
  if (url.origin === location.origin && url.pathname.startsWith("/javeda/")) return e.respondWith(page(e));
});

// the network first (a few seconds), then the saved copy; a level page is the same file whatever its ?part=
async function page(e){
  const req = e.request, c = await caches.open(PAGES);
  const key = new URL(req.url); key.search = ""; key.hash = "";
  const net = fetch(req).then(r => { if (r && r.ok && r.type === "basic") c.put(key.href, r.clone()).catch(() => {}); return r; });
  e.waitUntil(net.catch(() => {}));
  const saved = () => c.match(key.href).then(r => r || (req.mode === "navigate" ? c.match(new URL("./", location).href) : null));
  try {
    return await Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error("slow")), 4000))]);
  } catch(err){
    const r = await saved(); if (r) return r;
    return net.catch(() => new Response("JAVEDA is offline and this page isn't saved yet.", { status:503, headers:{ "Content-Type":"text/plain; charset=utf-8" } }));
  }
}

// a versioned library or a font: the saved copy, else the network (and save it)
async function lib(req){
  const c = await caches.open(LIBS), hit = await c.match(req.url);
  if (hit) return hit;
  const r = await fetch(req.url, { mode:"cors" }).catch(() => fetch(req));
  if (r && (r.ok || r.type === "opaque")) c.put(req.url, r.clone()).catch(() => {});
  return r;
}

// a song: from the phone if it's saved (cut to the range asked for), else straight from the network while the
// whole file is saved in the background for next time
async function song(e){
  const req = e.request, url = req.url.split("?")[0], c = await caches.open(SONGS);
  const hit = await c.match(url);
  if (!hit){
    e.waitUntil(saveSong(url));
    return fetch(req);
  }
  return ranged(hit, req.headers.get("range"));
}
async function saveSong(url){
  const c = await caches.open(SONGS);
  if (await c.match(url)) return true;
  const r = await fetch(url, { mode:"cors", cache:"no-store" });
  if (!r.ok) return false;
  await c.put(url, r);
  return true;
}
async function ranged(res, range){
  if (!range) return res;
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] !== "" ? +m[1] : 0, end = m && m[2] !== "" ? +m[2] : size - 1;
  if (m && m[1] === "" && m[2] !== ""){ start = Math.max(0, size - +m[2]); end = size - 1; }   // the last n bytes
  if (start >= size) return new Response(null, { status:416, headers:{ "Content-Range":"bytes */" + size } });
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), { status:206, statusText:"Partial Content", headers:{
    "Content-Type": res.headers.get("Content-Type") || "audio/mpeg", "Content-Range":"bytes " + start + "-" + end + "/" + size,
    "Content-Length": String(end - start + 1), "Accept-Ranges":"bytes" } });
}

// from the page: save every song for playing offline (it reports each one as it goes), or say which are saved
self.addEventListener("message", e => {
  const d = e.data || {}, port = e.ports && e.ports[0];
  if (d.type === "songs:saved"){
    e.waitUntil(caches.open(SONGS).then(c => c.keys()).then(ks => port && port.postMessage({ saved:ks.map(k => k.url) })));
  }
  if (d.type === "songs:save" && Array.isArray(d.urls)){
    e.waitUntil((async () => {
      let done = 0, failed = 0;
      for (const u of d.urls){
        try { if (!(await saveSong(u))) failed++; } catch(err){ failed++; }
        done++; if (port) port.postMessage({ done, failed, total:d.urls.length });
      }
    })());
  }
});
