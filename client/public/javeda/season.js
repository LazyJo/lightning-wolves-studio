/* JAVEDA - the seasons. Six events a year on the same dates (Brussels): winter 1 Dec - 6 Jan, valentine 7-21 Feb,
   spring 20 Mar - 20 Apr, summer 21 Jun - 31 Aug, halloween 24 Oct - 2 Nov, autumn 3-30 Nov (javeda_event_at has the
   same dates and runs the event itself: its board, double points, pictures, prizes).
   This file only dresses the page: html[data-season] (the JAVEDA page's colours follow it), a few drifting particles
   (snow, hearts, petals, fireflies, bats) and, on the JAVEDA page, a short welcome the first time in a season.
   Loaded in the <head> of the JAVEDA page and of every level. Preview before the dates: ?season=winter (it sticks on
   this phone, levels too) and ?season=off to go back. No particles for "reduce motion". */
(function(){
  const KINDS = ["winter", "valentine", "spring", "summer", "halloween", "autumn"];
  // today's month and day in Brussels
  function today(){
    try { const p = new Intl.DateTimeFormat("en-GB", { timeZone:"Europe/Brussels", month:"numeric", day:"numeric" }).formatToParts(new Date());
      return { m:+p.find(x => x.type === "month").value, d:+p.find(x => x.type === "day").value }; }
    catch(e){ const n = new Date(); return { m:n.getMonth() + 1, d:n.getDate() }; }
  }
  function kindOn(t){
    const md = t.m * 100 + t.d;
    if (md >= 1201 || md <= 106) return "winter";
    if (md >= 207 && md <= 221) return "valentine";
    if (md >= 320 && md <= 420) return "spring";
    if (md >= 621 && md <= 831) return "summer";
    if (md >= 1024 && md <= 1102) return "halloween";
    if (md >= 1103 && md <= 1130) return "autumn";
    return null;
  }
  let force = null;
  try {
    const q = new URLSearchParams(location.search).get("season");
    if (q === "off") localStorage.removeItem("javeda.season");
    else if (KINDS.includes(q)) localStorage.setItem("javeda.season", q);
    force = localStorage.getItem("javeda.season");
  } catch(e){}
  const kind = KINDS.includes(force) ? force : kindOn(today());
  window.JAVEDA_SEASON = kind;
  if (!kind) return;
  document.documentElement.dataset.season = kind;

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hub = !/\/levels\//.test(location.pathname);
  const COLORS = { winter:["#ffffff", "#dff3ff", "#bfe9ff"], valentine:["#ff6fae", "#ff3d8b", "#ffc2dc"], spring:["#ffc6e0", "#ffe3ef", "#fff4f8"],
    summer:["#ffe27a", "#fff2b0", "#ffd25a"], halloween:["#ff9d2e", "#1a0b24", "#2b1238"], autumn:["#e8761c", "#c4451c", "#f2b33d", "#9a3412"] };

  function start(){
    if (!still) particles();
    if (hub) welcome();
  }
  // a few particles on a canvas over the page that never takes a tap
  function particles(){
    const cv = document.createElement("canvas"), g = cv.getContext("2d"); if (!g) return;
    cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:" + (hub ? 15 : 20);
    document.body.appendChild(cv);
    const N = hub ? (kind === "summer" ? 26 : 38) : (kind === "summer" ? 12 : 16), col = COLORS[kind];
    let W = 0, H = 0, ps = [], last = 0;
    const size = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
    size(); addEventListener("resize", size);
    const make = top => ({ x:Math.random() * W, y:top ? -20 - Math.random() * H * .3 : Math.random() * H, s:.6 + Math.random() * .9,
      v:.3 + Math.random() * .7, w:Math.random() * 6.28, c:col[Math.floor(Math.random() * col.length)], r:Math.random() * 6.28 });
    for (let i = 0; i < N; i++) ps.push(make(false));
    function heart(x, y, s){ g.beginPath(); g.moveTo(x, y + s * .3); g.bezierCurveTo(x - s, y - s * .5, x - s * .5, y - s * 1.2, x, y - s * .5);
      g.bezierCurveTo(x + s * .5, y - s * 1.2, x + s, y - s * .5, x, y + s * .3); g.fill(); }
    function bat(x, y, s, f){ const k = Math.sin(f) * .6; g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x - s * .6, y - s * (.6 + k), x - s * 1.3, y - s * k * .4); g.quadraticCurveTo(x - s * .7, y + s * .1, x, y + s * .25);
      g.quadraticCurveTo(x + s * .7, y + s * .1, x + s * 1.3, y - s * k * .4); g.quadraticCurveTo(x + s * .6, y - s * (.6 + k), x, y); g.fill(); }
    // in a level: nothing while a run is being played (only its start and end screens), so the game never pays for it
    const playing = () => { if (hub) return false; try { return typeof S === "object" && !!S && !!S.started && !S.done && !S.fail && !(S.end >= 0); } catch(e){ return false; } };
    let blank = false;
    function frame(t){
      requestAnimationFrame(frame);
      if (document.hidden || t - last < 33) return;          // ~30 frames a second is plenty
      if (playing()){ if (!blank){ g.clearRect(0, 0, W, H); cv.style.display = "none"; blank = true; } last = t; return; }
      if (blank){ cv.style.display = ""; blank = false; }
      const dt = Math.min(3, (t - last) / 16.7); last = t;
      g.clearRect(0, 0, W, H);
      for (const p of ps){
        p.w += .02 * dt; p.r += .01 * dt;
        if (kind === "winter"){ p.y += p.v * 1.1 * dt; p.x += Math.sin(p.w) * .4 * dt;
          g.globalAlpha = .55 + p.s * .3; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 1.4 + p.s * 1.8, 0, 6.28); g.fill(); }
        else if (kind === "valentine"){ p.y += p.v * .8 * dt; p.x += Math.sin(p.w) * .5 * dt; g.globalAlpha = .35 + p.s * .3; g.fillStyle = p.c; heart(p.x, p.y, 4 + p.s * 5); }
        else if (kind === "spring"){ p.y += p.v * .9 * dt; p.x += (Math.sin(p.w) * .7 + .35) * dt;
          g.globalAlpha = .5 + p.s * .3; g.fillStyle = p.c; g.save(); g.translate(p.x, p.y); g.rotate(p.r * 2); g.beginPath(); g.ellipse(0, 0, 3 + p.s * 3, 1.6 + p.s * 1.4, 0, 0, 6.28); g.fill(); g.restore(); }
        else if (kind === "autumn"){ p.y += p.v * .9 * dt; p.x += (Math.sin(p.w) * 1.1 + .25) * dt;            // leaves, swaying as they fall
          g.globalAlpha = .75; g.fillStyle = p.c; g.save(); g.translate(p.x, p.y); g.rotate(p.r * 3 + Math.sin(p.w) * .8); const z = 4 + p.s * 4;
          g.beginPath(); g.moveTo(0, -z); g.quadraticCurveTo(z * .9, -z * .2, 0, z); g.quadraticCurveTo(-z * .9, -z * .2, 0, -z); g.fill(); g.restore(); }
        else if (kind === "summer"){ p.x += Math.sin(p.w) * .5 * dt; p.y += Math.cos(p.w * .8) * .35 * dt - .08 * dt;
          const a = .25 + .55 * Math.max(0, Math.sin(p.w * 2.3 + p.r)); g.globalAlpha = a; g.fillStyle = p.c;
          g.shadowColor = p.c; g.shadowBlur = 8; g.beginPath(); g.arc(p.x, p.y, 1.5 + p.s * 1.4, 0, 6.28); g.fill(); g.shadowBlur = 0; }
        else { p.x += (p.v * 1.2 + .4) * dt; p.y += Math.sin(p.w * 1.7) * .6 * dt;            // halloween: bats crossing, a few embers
          g.globalAlpha = .7; g.fillStyle = p.c === col[0] ? "#ff9d2e" : "#0b0510";
          if (p.c === col[0]){ g.globalAlpha = .45 + .3 * Math.sin(p.w * 3); g.beginPath(); g.arc(p.x, p.y, 1.4 + p.s, 0, 6.28); g.fill(); }
          else bat(p.x, p.y, 5 + p.s * 6, p.w * 9); }
        if (p.y > H + 20 || p.x > W + 30 || p.x < -30 || p.y < -60) Object.assign(p, make(true), kind === "halloween" ? { x:-20, y:Math.random() * H * .7 } : kind === "summer" ? { y:H * Math.random() } : {});
      }
      g.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }
  // the JAVEDA page, the first time in a season on this phone: a short "Winter is here"
  function welcome(){
    const key = "javeda.season.seen", tag = kind + "-" + new Date().getFullYear();
    try { if (localStorage.getItem(key) === tag) return; localStorage.setItem(key, tag); } catch(e){ return; }
    const E = { winter:"❄️", valentine:"💘", spring:"🌸", summer:"☀️", halloween:"🎃", autumn:"🍂" }[kind];
    const N = { winter:"Winter event", valentine:"Valentine event", spring:"Spring event", summer:"Summer event", halloween:"Halloween event", autumn:"Autumn event" }[kind];
    const o = document.createElement("div"); o.className = "season-hello";
    o.innerHTML = '<span class="se" aria-hidden="true">' + E + '</span><b>' + N + '</b><small>JAVEDA</small>';
    document.body.appendChild(o);
    requestAnimationFrame(() => o.classList.add("on"));
    setTimeout(() => o.classList.remove("on"), still ? 1600 : 2300);
    setTimeout(() => o.remove(), still ? 2200 : 3200);
    o.addEventListener("click", () => o.remove());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
