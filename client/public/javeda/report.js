/* JAVEDA - when something breaks in a level or on the JAVEDA page, Lazy Jo hears about it.
   Catches the errors the page doesn't catch itself and hands them to the JAVEDA page (a level runs in its frame),
   which sends them on (javeda_report). What goes: the error and where in the code, the page, the kind of phone and
   browser, the language, and whether it's the installed app. Nothing else (the privacy page says the same).
   Loaded first by every level page and by the JAVEDA page. */
(function(){
  const sent = new Set(); let n = 0;
  // the phone and browser in a few words: 'iPhone · iOS 17.4 · Safari', 'Android 14 · Samsung Internet 25', 'Windows · Chrome 129'
  function device(){
    const u = navigator.userAgent, m = (re) => (u.match(re) || [])[1];
    const ipad = /iPad/.test(u) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const os = /iPhone/.test(u) ? "iPhone · iOS " + (m(/OS (\d+[_.]\d+)/) || "").replace("_", ".")
      : ipad ? "iPad · iPadOS " + (m(/OS (\d+[_.]\d+)/) || m(/Version\/(\d+\.\d+)/) || "").replace("_", ".")
      : /Android/.test(u) ? "Android " + (m(/Android (\d+)/) || "")
      : /Windows/.test(u) ? "Windows" : /Mac OS X/.test(u) ? "Mac" : /CrOS/.test(u) ? "Chromebook" : /Linux/.test(u) ? "Linux" : "other";
    const br = /SamsungBrowser\/(\d+)/.test(u) ? "Samsung Internet " + m(/SamsungBrowser\/(\d+)/)
      : /Instagram/.test(u) ? "Instagram" : /FBAN|FBAV/.test(u) ? "Facebook" : /TikTok|musical_ly/.test(u) ? "TikTok"
      : /Edg\/(\d+)/.test(u) ? "Edge " + m(/Edg\/(\d+)/) : /OPR\/(\d+)/.test(u) ? "Opera"
      : /CriOS\/(\d+)/.test(u) ? "Chrome " + m(/CriOS\/(\d+)/) : /FxiOS|Firefox/.test(u) ? "Firefox"
      : /Chrome\/(\d+)/.test(u) ? "Chrome " + m(/Chrome\/(\d+)/) : /Safari/.test(u) ? "Safari" : "browser";
    return os.trim() + " · " + br;
  }
  window.JAVEDA_DEVICE = device;
  // noise that isn't a bug in JAVEDA: blocked autoplay, an extension, a browser quirk
  const NOISE = /^Script error\.?$|ResizeObserver loop|NotAllowedError|AbortError|The play\(\) request was interrupted|play\(\) failed|chrome-extension|moz-extension|safari-extension|Non-Error promise rejection/i;
  function report(message, detail){
    message = String(message || "").replace(/^Uncaught (?:exception: )?/, "").slice(0, 400); if (!message || NOISE.test(message) || NOISE.test(detail || "")) return;
    // a stack that never passes through a file: code the browser put in the page itself (Chrome on iPhone does that), not JAVEDA's
    if (/\n/.test(detail || "") && !/https?:|\.js|\.html|\/javeda\//.test(detail)) return;
    if (sent.has(message) || ++n > 5) return; sent.add(message);
    const r = { kind:"error", message, detail:String(detail || "").slice(0, 2000), page:location.pathname + location.search.replace(/[?&](room|rides)=[^&]*/g, ""),
      device:device(), lang:window.JAVEDA_LANG || "", app:matchMedia("(display-mode: standalone)").matches || navigator.standalone === true };
    try {
      if (window.parent !== window) window.parent.postMessage({ type:"javeda:report", report:r }, location.origin);
      else (window.__javedaReports = window.__javedaReports || []).push(r), window.JAVEDA_REPORT && window.JAVEDA_REPORT();
    } catch(e){}
  }
  addEventListener("error", e => {
    if (!e.message && e.target && e.target !== window) return;     // a picture or a sound that didn't load: not a crash
    report(e.message, (e.error && e.error.stack) || (e.filename ? e.filename.split("/").pop() + ":" + e.lineno + ":" + e.colno : ""));
  });
  addEventListener("unhandledrejection", e => {
    const r = e.reason; report(r && (r.message || r.name) || String(r), r && r.stack);
  });
})();
