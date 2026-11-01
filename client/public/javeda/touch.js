/* JAVEDA - a finger on a level belongs to the level, on every phone.
   An iPhone (Safari, and every iPhone browser is Safari underneath) will start scrolling, zooming or swiping
   back under a game as soon as a finger moves - and then it takes the finger away from the game half way
   through a swipe or a drag. Android and computers mostly don't, but nothing here hurts them.
   Loaded by every level page, before the level's own code. */
(function(){
  // the page itself never moves: no rubber-band, no pull-to-refresh, no double-tap zoom, no long-press menu
  const st = document.createElement("style");
  st.textContent = "html,body{overscroll-behavior:none;touch-action:manipulation;-webkit-touch-callout:none;-webkit-text-size-adjust:100%}" +
    "canvas{touch-action:none}";
  (document.head || document.documentElement).appendChild(st);

  // a moving finger is the game's - unless it is in a list that scrolls (a scoreboard, a long card)
  const scrolls = el => {
    for (; el && el.nodeType === 1 && el !== document.body && el !== document.documentElement; el = el.parentElement){
      const s = getComputedStyle(el);
      if ((/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) ||
          (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1)) return true;
    }
    return false;
  };
  document.addEventListener("touchmove", e => { if (e.cancelable && !scrolls(e.target)) e.preventDefault(); }, { passive:false });

  // two fingers: no pinch-zoom (an iPhone ignores user-scalable=no)
  for (const t of ["gesturestart", "gesturechange"]) document.addEventListener(t, e => e.preventDefault(), { passive:false });
})();
