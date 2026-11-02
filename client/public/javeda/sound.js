/* JAVEDA - the song and the game's own sounds, each on or off (the two buttons the hub puts over a level).
   Every level plays its song with new Audio(...) and its sounds through a Web Audio context, so both are caught
   here and the levels stay as they are: the song is muted (it keeps playing, so the beat stays in time), the
   sounds go through one gate before the speakers. The choice is kept in localStorage "javeda.sound.v1"
   ({"song":true,"sfx":true}), shared with the hub, and a change made while a level is open reaches it at once.
   Loaded by every level page, before the level's own code. */
(function(){
  const KEY = "javeda.sound.v1";
  const read = () => {
    try { const x = JSON.parse(localStorage.getItem(KEY)); return { song: !x || x.song !== false, sfx: !x || x.sfx !== false }; }
    catch(e){ return { song:true, sfx:true }; }
  };
  let st = read();
  const songs = [], gates = [];
  const apply = () => {
    for (const a of songs) a.muted = !st.song;
    for (const g of gates) try { g.gain.value = st.sfx ? 1 : 0; } catch(e){}
  };

  // the song
  const A = window.Audio;
  if (A){
    const Song = function(src){ const a = arguments.length ? new A(src) : new A(); a.muted = !st.song; songs.push(a); return a; };
    Song.prototype = A.prototype;
    window.Audio = Song;
  }

  // the game's sounds: whatever a level sends to its context's speakers goes through the gate
  for (const name of ["AudioContext", "webkitAudioContext"]){
    const C = window[name]; if (!C) continue;
    const Ctx = function(opts){
      const ac = opts === undefined ? new C() : new C(opts);
      try {
        const out = ac.destination, gate = ac.createGain();
        gate.gain.value = st.sfx ? 1 : 0; gate.connect(out);
        Object.defineProperty(ac, "destination", { get: () => gate, configurable: true });
        gates.push(gate);
      } catch(e){}
      return ac;
    };
    Ctx.prototype = C.prototype;
    window[name] = Ctx;
  }

  addEventListener("storage", e => { if (e.key === KEY){ st = read(); apply(); } });
  addEventListener("message", e => {
    const x = e.origin === location.origin && e.data && e.data.javedaSound;
    if (x){ st = { song: x.song !== false, sfx: x.sfx !== false }; apply(); }
  });
})();
