/* JAVEDA - online games that survive a phone going to another app.
   Friends set up a private room over WhatsApp: they switch apps, and a phone puts the game to sleep. Its connection
   goes quiet, but for up to a minute the server still lists it as "here" - so the other one gets "Found Zirka",
   goes into the room, and waits for a phone that is asleep. This add-on, for every online level (their NET object:
   seek / waiting / pair / join / back, lobby and room channels):
   - while looking, each player says "still here" every 4 s (a beat in their lobby presence); a player whose beat
     stopped for 11 s isn't paired with any more;
   - leaving the game for another app takes you out of the line, and coming back reconnects fresh and puts you
     straight back in line (unless a match is already being played);
   - in the room, after a few seconds without an answer: who it's waiting for, and to keep JAVEDA open.
   Loaded by the online levels; it only touches NET when it's there. */
(function(){
  const BEAT = 4000, STALE = 11000;
  let beat = 0, away = false, timer = 0;
  const seen = new Map();   // player id -> { beat, at } (at: when this phone last saw their beat change)
  const net = () => (typeof NET !== "undefined" && NET && NET.sb) ? NET : null;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  let patched = false;
  function patch(n){
    if (patched) return; patched = true;
    // the line: only players who are really there (their beat moved in the last 11 s), and always yourself
    const waiting = n.waiting.bind(n);
    n.waiting = function(){
      const now = Date.now();
      return waiting().filter(p => {
        if (p.id === n.me) return true;
        const b = p.beat | 0, s = seen.get(p.id);
        if (!s || s.beat !== b) seen.set(p.id, { beat:b, at:now });
        return now - seen.get(p.id).at < STALE;
      });
    };
    // in the room: say who we're waiting for
    const join = n.join.bind(n);
    n.join = function(){
      const r = join.apply(this, arguments);
      clearTimeout(n._waitT);
      n._waitT = setTimeout(() => {
        if (n.state !== "room") return;
        const who = (n.players && n.players.length ? n.players.filter(p => p.id !== n.me) : n.opp ? [n.opp] : []).map(p => "<b>" + esc(p.name) + "</b>").join(", ") || "them";
        n.status("Waiting for " + who + " to answer&hellip; keep JAVEDA open on both phones.", true);
      }, 3500);
      return r;
    };
  }
  // the beat: re-say who you are, with a number that goes up
  function tick(){
    const n = net(); if (!n) return;
    patch(n);
    if (n.state === "seek" && n.lobby && !document.hidden){
      beat++;
      try { n.lobby.track({ id:n.me, name:n.name, since:n.since, beat }); } catch(e){}
    }
  }
  // back from another app: a fresh connection and straight back in line
  function fresh(n){
    clearInterval(n.goT); clearTimeout(n.roomT); clearTimeout(n._waitT);
    for (const c of [n.room, n.lobby]) if (c) try { n.sb.removeChannel(c); } catch(e){}
    // the old connection may look open but be dead after the phone slept: close it, the next join opens a new one
    try { n.sb.realtime.disconnect(); } catch(e){}
    n.room = null; n.lobby = null; n.opp = null; if (Array.isArray(n.players)) n.players = []; n.match = null;
    seen.clear();
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
  timer = setInterval(tick, BEAT);
})();
