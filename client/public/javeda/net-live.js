/* JAVEDA - online games that start, on real phones.
   For every online level (their NET object: seek / waiting / pair / join / back / roomSync / hear / send,
   a lobby channel and a room channel on Supabase Realtime).
   1. A phone that went to another app (WhatsApp, to send the room link) is asleep, but for up to a minute the
      server still lists it. So: while looking, each player says "still here" every 4 s, and one whose beat
      stopped for 11 s isn't paired; going to another app takes you out of the line; coming back closes the old
      connection (it can look open and be dead) and puts you straight back in line.
   2. The start never hangs on one way of talking: the "go" and its "ack" go as messages AND in the room's
      presence (the part that already shows the names); and if the other player doesn't show in the room's
      presence after 2.5 s, the first player sends "go" anyway - the ack is the proof they're there.
   3. The lobby and the room run on a connection of their own, made with the public key only: the login's token
      expires every hour, and the server closes a channel joined with an expired token for good (a phone that
      slept past the refresh came back to a closed lobby). Who you are is still checked once, by the level.
      Back from another app: a whole new connection, the old one shut down on its own; a dead one is noticed in 10 s.
   4. Stuck anyway: a small line says what works and what doesn't (a screenshot tells where it hangs), and the
      second failed start sends a report to the creator's Reports.
   Loaded by the online levels; it only touches NET once it's there. */
(function(){
  const BEAT = 4000, STALE = 11000, FORCE = 2500;
  let beat = 0, away = false, patched = false, fails = 0, reported = false, lastFresh = 0;
  const seen = new Map();   // player id -> { beat, at }: when this phone last saw their beat change
  const diag = { lobby:"-", room:"-", sent:{}, heard:{}, them:false, via:"" };
  const net = () => (typeof NET !== "undefined" && NET && NET.sb) ? NET : null;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const others = n => (Array.isArray(n.players) && n.players.length ? n.players : n.opp ? [n.opp] : []).filter(p => p && p.id !== n.me);

  // a Supabase client for the lobby and the room only: no login (nothing to expire), a quick heartbeat
  function makeRt(n){
    try {
      if (!n.sb.supabaseUrl || !window.supabase || !window.supabase.createClient) return n.sb;
      return window.supabase.createClient(n.sb.supabaseUrl, n.sb.supabaseKey, {
        auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false, storageKey:"javeda-live" },
        realtime:{ heartbeatIntervalMs:10000 } });
    } catch(e){ return n.sb; }
  }
  function drop(c){ try { if (c.removeAllChannels) c.removeAllChannels().catch(() => {}); else if (c.realtime) c.realtime.disconnect(); } catch(e){} }
  function patch(n){
    if (patched) return; patched = true;
    n.rt = makeRt(n);
    // the line: only players who are really there (their beat moved in the last 11 s), and always yourself
    const waiting = n.waiting.bind(n);
    n.waiting = function(){
      const now = Date.now();
      return waiting().filter(p => {
        if (p.id === n.me) return true;
        const metas = (n.lobby && n.lobby.presenceState()[p.id]) || [p], b = Math.max(0, ...metas.map(m => (m && m.beat) | 0)), s = seen.get(p.id);
        if (!s || s.beat !== b) seen.set(p.id, { beat:b, at:now });
        return now - seen.get(p.id).at < STALE;
      });
    };
    // which channel is being made, and how its connection goes (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED)
    let making = "lobby";
    const chan = n.chan.bind(n);
    n.chan = function(name){
      const kind = making, ch = n.rt && n.rt !== n.sb ? n.rt.channel(name, { config:{ presence:{ key:n.me }, broadcast:{ self:false } } }) : chan(name), sub = ch.subscribe.bind(ch);
      ch.subscribe = (cb, t) => sub((s, err) => {
        // an old channel closing (after a reconnect) is not news: only the one in use counts
        if ((kind === "lobby" ? n.lobby : n.room) === ch){
          diag[kind] = s + (err ? " (" + (err.message || err) + ")" : ""); show(n);
          // a closed channel never comes back by itself: while waiting, reconnect (at most every 5 s)
          if (s === "CLOSED" && (n.state === "seek" || n.state === "room") && Date.now() - lastFresh > 5000){
            lastFresh = Date.now(); setTimeout(() => { if (n.state === "seek" || n.state === "room") fresh(n); }, 1200);
          }
        }
        if (cb) cb(s, err);
      }, t);
      return ch;
    };
    const seek = n.seek.bind(n);
    n.seek = function(){ making = "lobby"; return seek.apply(this, arguments); };
    // the room: the waiting line, the forced go, the go/ack through presence
    const join = n.join.bind(n);
    n.join = function(){
      making = "room"; diag.room = "joining"; diag.sent = {}; diag.heard = {}; diag.them = false; diag.via = "";
      n._go = null; n._ack = null;
      const r = join.apply(this, arguments);
      const at = Date.now();
      clearTimeout(n._waitT); clearInterval(n._forceT);
      n._waitT = setTimeout(() => {
        if (n.state !== "room") return;
        n.status("Waiting for " + (others(n).map(p => "<b>" + esc(p.name) + "</b>").join(", ") || "them") + " to answer&hellip; keep JAVEDA open on both phones.", true);
        show(n);
      }, 3500);
      n._forceT = setInterval(() => {
        if (n.state !== "room" || !n.room){ clearInterval(n._forceT); show(n); return; }
        if (n.seat === 0 && !n.match && Date.now() - at > FORCE && /SUBSCRIBED/.test(diag.room)){
          // they don't show in the room's presence: say go anyway (their ack proves they're there)
          const real = n.room._real = n.room._real || n.room.presenceState.bind(n.room);
          n.room.presenceState = () => { const st = real(); for (const p of others(n)) if (!st[p.id] || !st[p.id].length) st[p.id] = [{ id:p.id, name:p.name }]; return st; };
          diag.via = "forced";
          try { n.roomSync(); } catch(e){}
        }
        show(n);
      }, 500);
      return r;
    };
    const back = n.back.bind(n);
    n.back = function(){
      clearInterval(n._forceT);
      if (n.state === "room"){ fails++; if (fails >= 2) report(n, "online: the start hung twice"); }
      return back.apply(this, arguments);
    };
    // every message counted; the go and the ack also put in the room's presence
    const send = n.send.bind(n);
    n.send = function(ev, p){
      diag.sent[ev] = (diag.sent[ev] || 0) + 1;
      if (ev === "go" && !n._go){ n._go = Object.assign({ from:n.me }, p); say(n); }
      if (ev === "ack" && p && n._ack !== p.match){ n._ack = p.match; say(n); }
      return send.apply(this, arguments);
    };
    const hear = n.hear.bind(n);
    n.hear = function(ev, p){ diag.heard[ev] = (diag.heard[ev] || 0) + 1; return hear.apply(this, arguments); };
    const roomSync = n.roomSync.bind(n);
    n.roomSync = function(){
      const r = roomSync.apply(this, arguments);
      if (!n.room) return r;
      const st = (n.room._real || n.room.presenceState.bind(n.room))(); diag.them = others(n).length > 0 && others(n).every(p => st[p.id] && st[p.id].length);
      if (n.state === "room") for (const k in st) for (const m of st[k] || []){
        if (!m || m.id === n.me) continue;
        if (n.seat !== 0 && m.go && m.go.match && !n.match){ diag.via = diag.via || "presence"; n.hear("go", Object.assign({}, m.go, { from:m.id })); }
        if (n.seat === 0 && m.ack && n.match && m.ack === n.match){ diag.via = diag.via || "presence"; n.hear("ack", { match:m.ack, from:m.id }); }
      }
      show(n);
      return r;
    };
  }
  // the room's presence: who you are, and the go / ack you've said
  function say(n){ if (!n.room) return; try { n.room.track(Object.assign({ id:n.me, name:n.name }, n._go ? { go:n._go } : {}, n._ack ? { ack:n._ack } : {})); } catch(e){} }

  // the check line, under the status: only while it hangs
  function show(n){
    let el = document.getElementById("netcheck");
    const hang = n.state === "room" || /ERROR|TIMED_OUT|CLOSED/.test(diag.lobby + diag.room);
    if (!hang){ if (el) el.remove(); return; }
    const net = document.getElementById("net"); if (!net) return;
    if (!el){ el = document.createElement("p"); el.id = "netcheck"; el.setAttribute("data-i18n-skip", "");
      el.style.cssText = "font:600 12px/1.4 system-ui,sans-serif;opacity:.7;margin:6px auto 0;max-width:46ch;letter-spacing:0;text-transform:none";
      net.insertAdjacentElement("afterend", el); }
    const ok = s => /SUBSCRIBED/.test(s) ? "&#10003;" : esc(s);
    const sum = o => Object.entries(o).map(([k, v]) => k + " " + v).join(", ") || "nothing";
    const live = n.rt && n.rt.realtime && n.rt.realtime.isConnected ? (n.rt.realtime.isConnected() ? "&#10003;" : "&#10007;") : "?";
    el.innerHTML = "check: net " + live + " &middot; lobby " + ok(diag.lobby) + " &middot; room " + ok(diag.room) + " &middot; them in room " + (diag.them ? "&#10003;" : "&#10007;") +
      " &middot; sent " + sum(diag.sent) + " &middot; got " + sum(diag.heard) + (diag.via ? " &middot; " + diag.via : "") + (n.seat === 0 ? " &middot; first" : " &middot; second");
  }
  function report(n, what){
    if (reported) return; reported = true;
    const r = { kind:"error", message:what, detail:JSON.stringify({ lobby:diag.lobby, room:diag.room, them:diag.them, sent:diag.sent, got:diag.heard, via:diag.via, seat:n.seat, state:n.state, online:navigator.onLine }),
      page:location.pathname + location.search.replace(/[?&](room|rides)=[^&]*/g, ""), device:window.JAVEDA_DEVICE ? window.JAVEDA_DEVICE() : "", lang:window.JAVEDA_LANG || "",
      app:matchMedia("(display-mode: standalone)").matches || navigator.standalone === true };
    try { if (window.parent !== window) window.parent.postMessage({ type:"javeda:report", report:r }, location.origin); } catch(e){}
  }
  // the beat: re-say who you are, with a number that goes up
  function tick(){
    const n = net(); if (!n) return;
    if (n.state === "seek" && n.lobby && !document.hidden){
      beat++;
      try { n.lobby.track({ id:n.me, name:n.name, since:n.since, beat }); } catch(e){}
    }
  }
  // back from another app: a fresh connection and straight back in line
  function fresh(n){
    clearInterval(n.goT); clearInterval(n._forceT); clearTimeout(n.roomT); clearTimeout(n._waitT);
    // the old connection may look open but be dead after the phone slept: a new one, and the old shut down apart
    const old = n.rt; n.rt = makeRt(n); if (old && old !== n.sb && old !== n.rt) drop(old);
    else for (const c of [n.room, n.lobby]) if (c) try { c.unsubscribe(); } catch(e){}
    n.room = null; n.lobby = null; n.opp = null; if (Array.isArray(n.players)) n.players = []; n.match = null;
    seen.clear(); diag.lobby = "-"; diag.room = "-";
    n.seek();
  }
  document.addEventListener("visibilitychange", () => {
    const n = net(); if (!n) return;
    if (document.hidden){
      if (n.state === "seek" || n.state === "room"){ away = true; try { if (n.lobby) n.lobby.untrack(); } catch(e){} }
    } else if (away){
      away = false;
      if (n.state === "seek" || n.state === "room") fresh(n);
    }
  });
  // patch as soon as the level has made its connection (before anyone taps Join)
  const wait = setInterval(() => { const n = net(); if (n){ patch(n); clearInterval(wait); } }, 200);
  setInterval(tick, BEAT);
})();
