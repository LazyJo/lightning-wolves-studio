/* ═══════════════════════════════════════════════════════════════════════════
   LIGHTNING WOLVES LYRICS STUDIO — Frontend Application
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

let supabase = null;

async function initSupabase() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('no config');
    const cfg = await res.json();
    if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
      supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    }
  } catch {
    console.info('Supabase not configured, running in guest mode');
  }
}

const state = {
  page: 'wolf-select',
  wolf: null,
  user: null,
  profile: null,
  token: null,
  lastPack: null,
  lastMeta: null,
  uploadedFile: null,
  transcript: null,
  generating: false,
};

const $ = id => document.getElementById(id);
const show = el => el && el.classList.remove('hidden');
const hide = el => el && el.classList.add('hidden');

window.showPage = function(name) {
  // Lightning flash when entering studio
  if (name === 'studio' && state.page !== 'studio') {
    const flash = $('lightning-flash');
    if (flash) {
      flash.classList.remove('hidden', 'active');
      void flash.offsetWidth; // force reflow
      flash.classList.add('active');
      setTimeout(() => { flash.classList.add('hidden'); flash.classList.remove('active'); }, 600);
    }
  }

  // Hide all pages
  ['wolf-select', 'studio', 'dashboard', 'auth', 'wolf-hub'].forEach(p => {
    const el = $(`${p}-page`);
    if (el) hide(el);
  });
  const idMap = {
    'wolf-select': 'wolf-select-page',
    'studio': 'studio-page',
    'dashboard': 'dashboard-page',
    'auth': 'auth-page',
    'wolf-hub': 'wolf-hub-page',
  };
  const el = $(idMap[name]);
  if (el) show(el);
  state.page = name;

  // Mobile nav: hide on auth, show elsewhere (CSS hides on desktop)
  const mnav = $('mobile-nav');
  if (mnav) mnav.classList.toggle('hidden', name === 'auth');

  // Update elite header nav active state
  document.querySelectorAll('.elite-nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === name);
  });

  // Update elite header auth buttons
  const joinBtn = $('elite-join-btn');
  const signinBtn = $('elite-signin-btn');
  if (state.user && joinBtn) joinBtn.style.display = 'none';
  if (state.user && signinBtn) { signinBtn.textContent = 'SIGN OUT'; }

  // Update mobile nav active
  updateMobileNavActive(name);
}

// ─── Canvas ──────────────────────────────────────────────────────────────────
function initCanvas() {
  const canvas = $('lightning-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], bolts = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * W;
      this.y = Math.random() * H;
      this.size = Math.random() * 2 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.4;
      this.speedY = -Math.random() * 0.6 - 0.1;
      this.life = 1;
      this.decay = Math.random() * 0.003 + 0.001;
      const color = getComputedStyle(document.documentElement).getPropertyValue('--wolf-color').trim() || '#f5c518';
      this.color = color;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.life -= this.decay;
      if (this.life <= 0 || this.y < -10) this.reset();
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.life * 0.35;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < 80; i++) particles.push(new Particle());

  function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(loop);
  }
  loop();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
async function checkSession() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    state.user  = data.session.user;
    state.token = data.session.access_token;
    await loadProfile();
  }
}

async function loadProfile() {
  if (!supabase || !state.user) return;
  const { data } = await supabase.from('profiles').select('*').eq('id', state.user.id).single();
  state.profile = data;
}

function updateHeaderAuth() {
  const actionsEl = $('header-auth-actions');
  if (!actionsEl) return;
  if (state.user) {
    const name = state.profile?.display_name || state.user.email;
    actionsEl.innerHTML = `
      <span style="font-size:0.85rem;color:var(--muted)">${name}</span>
      ${state.profile?.role === 'member' ? '<button class="btn-outline btn-sm" id="open-dashboard">Dashboard</button>' : ''}
      <button class="btn-ghost btn-sm" id="header-signout">Sign Out</button>
    `;
    const dbBtn = $('open-dashboard');
    if (dbBtn) dbBtn.addEventListener('click', openDashboard);
    const soBtn = $('header-signout');
    if (soBtn) soBtn.addEventListener('click', signOut);
  } else {
    actionsEl.innerHTML = `<button class="btn-outline btn-sm" id="header-signin">Sign In</button>`;
    const si = $('header-signin');
    if (si) si.addEventListener('click', () => showPage('auth'));
  }
}

function updateStudioAuth() {
  const btn = $('studio-auth-btn');
  if (!btn) return;
  if (state.user) {
    btn.textContent = state.profile?.role === 'member' ? 'Dashboard' : 'Sign Out';
    btn.onclick = state.profile?.role === 'member' ? openDashboard : signOut;
  } else {
    btn.textContent = 'Sign In';
    btn.onclick = () => showPage('auth');
  }
}

async function signOut() {
  if (supabase) await supabase.auth.signOut();
  state.user = null;
  state.token = null;
  state.profile = null;
  updateHeaderAuth();
  updateStudioAuth();
  showPage('wolf-select');
}

// ─── Wolf Selection ───────────────────────────────────────────────────────────
function initWolfSelect() {
  document.querySelectorAll('.wolf-card.active').forEach(card => {
    card.addEventListener('click', () => {
      const wolf = {
        id: card.dataset.wolf,
        color: card.dataset.color,
        artist: card.dataset.artist,
        genre: card.dataset.genre,
        image: card.dataset.image
      };
      state.wolf = wolf;
      applyWolfTheme(wolf.color);
      const ai = $('song-artist'); if (ai) ai.value = wolf.artist;
      const gi = $('song-genre'); if (gi) gi.value = wolf.genre;
      showPage('studio');
    });
  });
  $('enter-public-studio').addEventListener('click', () => {
    state.wolf = { id: 'public', color: '#f5c518', artist: 'Guest', genre: 'Pop', image: 'logo.svg' };
    applyWolfTheme('#f5c518');
    showPage('studio');
  });
}

function applyWolfTheme(color) {
  document.documentElement.style.setProperty('--wolf-color', color);
  document.documentElement.style.setProperty('--accent', color);
}

// ─── Upload (Feed The Wolf → Whisper) ────────────────────────────────────────
function initUpload() {
  const zone = $('upload-zone');
  const input = $('file-input');
  const statusEl = $('upload-status');
  const statusText = $('upload-status-text');
  const pulse = $('upload-pulse');

  function setStatus(type, text) {
    statusEl.className = 'ftw-status ' + type;
    show(statusEl);
    statusText.textContent = text;
  }

  zone.addEventListener('click', () => input.click());

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'rgba(245,197,24,0.6)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });

  input.addEventListener('change', () => {
    if (input.files[0]) uploadFile(input.files[0]);
  });

  async function uploadFile(file) {
    if (file.size > 25 * 1024 * 1024) {
      setStatus('error', `File too large (${(file.size/1024/1024).toFixed(1)}MB). Max 25MB.`);
      return;
    }

    setStatus('uploading', 'Wolf is listening...');
    state.transcript = null;
    state.uploadedFile = null;

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { throw new Error('Server returned invalid response'); }
      if (!res.ok) throw new Error(json.error || 'Upload failed');

      if (json.transcript && json.transcript.segments && json.transcript.segments.length > 0) {
        state.transcript = json.transcript;
        state.uploadedFile = json;
        setStatus('success', `✓ Track consumed — ${file.name}`);
      } else {
        throw new Error('Whisper returned no transcription segments');
      }
    } catch (err) {
      setStatus('error', err.message);
    }
  }
}

// ─── Generate (real Whisper lyrics + Claude beats/prompts) ──────────────────
function initGenerate() {
  $('generate-btn').addEventListener('click', async () => {
    if (state.generating) return;

    const title = $('song-title').value.trim();
    const artist = $('song-artist').value.trim();
    const genre = $('song-genre').value;
    const language = $('song-language').value;
    const bpm = $('song-bpm').value;
    const mood = $('song-mood').value.trim();
    const errEl = $('gen-error');

    if (!title || !artist || !genre) {
      errEl.textContent = 'Please fill in Title, Artist, and Genre';
      show(errEl);
      return;
    }

    hide(errEl);
    state.generating = true;
    const btn = $('generate-btn');
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'GENERATING…';

    show($('waveform-wrap'));
    hide($('summary-card'));
    clearResults();
    updateStepper(1);

    try {
      const body = { title, artist, genre, language, wolfId: state.wolf?.id };
      if (bpm) body.bpm = bpm;
      if (mood) body.mood = mood;
      if (state.token) body.token = state.token;

      // Pass real Whisper transcript if available
      if (state.transcript) {
        body.transcript = state.transcript;
      }

      setTimeout(() => updateStepper(2), 3000);
      setTimeout(() => updateStepper(3), 6000);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch {
        throw new Error(res.status === 504 ? 'Request timed out — try again' : `Server error (${res.status})`);
      }
      if (!res.ok) throw new Error(json.error || 'Generation failed');

      state.lastPack = json.pack;
      state.lastMeta = json.meta;
      renderPack(json.pack, json.meta);

    } catch (err) {
      errEl.textContent = err.message;
      show(errEl);
    } finally {
      hide($('waveform-wrap'));
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'GENERATE';
      state.generating = false;
    }
  });
}

function updateStepper(step) {
  document.querySelectorAll('.step').forEach(s => {
    const sNum = parseInt(s.dataset.step);
    s.classList.toggle('active', sNum === step);
    s.classList.toggle('completed', sNum < step);
  });
}

function clearResults() {
  hide($('lyrics-content'));
  hide($('lyrics-editor-wrap'));
  show($('lyrics-empty'));
  hide($('srt-content'));
  show($('srt-empty'));
  hide($('beats-content'));
  show($('beats-empty'));
  hide($('prompts-content'));
  show($('prompts-empty'));
  hide($('tips-content'));
  show($('tips-empty'));
}

function renderPack(pack, meta) {
  const sc = $('summary-card');
  $('summary-wolf-img').src = `/${state.wolf?.image || 'logo.svg'}`;
  $('summary-title').textContent = meta.title;
  $('summary-artist').textContent = meta.artist;
  $('summary-genre').textContent = meta.genre;
  show(sc);

  renderLyrics(pack.lyrics || []);
  if (pack.srt) {
    $('srt-text').textContent = pack.srt;
    hide($('srt-empty')); show($('srt-content'));
  }
  renderBeats(pack.beats || []);
  renderPrompts(pack.prompts || []);
  renderTips(pack.tips || []);
}

function renderLyrics(lyrics) {
  const container = $('lyrics-content');
  container.innerHTML = '';
  let textContent = '';

  lyrics.forEach(line => {
    const text = line.text || '';
    textContent += `${line.ts || ''} ${text}\n`;
    const row = document.createElement('div');
    row.className = /^\[.+\]$/.test(text.trim()) ? 'lyric-section-header' : 'lyric-row';
    if (row.className === 'lyric-row') {
      row.innerHTML = `<span class="lyric-ts">${line.ts || ''}</span><span class="lyric-text">${text}</span>`;
    } else {
      row.textContent = text.replace(/[\[\]]/g, '');
    }
    container.appendChild(row);
  });

  $('lyrics-editor').value = textContent;
  hide($('lyrics-empty'));
  show(container);
  
  // Toggle editor on click
  container.onclick = () => {
    hide(container);
    show($('lyrics-editor-wrap'));
  };
  
  $('save-lyrics-btn').onclick = () => {
    // In a real app, we'd parse this back to JSON and save
    hide($('lyrics-editor-wrap'));
    show(container);
  };
}

function renderBeats(beats) {
  const tbody = $('beats-tbody');
  tbody.innerHTML = '';
  beats.forEach(beat => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="beat-ts">${beat.ts || ''}</td>
      <td>${beat.label || ''}</td>
      <td><span class="beat-type-badge beat-type-${beat.type || 'CUT'}">${beat.type || 'CUT'}</span></td>
    `;
    tbody.appendChild(tr);
  });
  if (beats.length) { hide($('beats-empty')); show($('beats-content')); }
}

function renderPrompts(prompts) {
  const container = $('prompts-content');
  container.innerHTML = '';
  prompts.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.innerHTML = `
      <div class="prompt-section-name">${p.section || ''}</div>
      <div class="prompt-text">${p.prompt || ''}</div>
      <button class="prompt-copy-btn" onclick="navigator.clipboard.writeText('${p.prompt.replace(/'/g, "\\'")}')">Copy</button>
    `;
    container.appendChild(card);
  });
  if (prompts.length) { hide($('prompts-empty')); show(container); }
}

function renderTips(tips) {
  const container = $('tips-content');
  container.innerHTML = '';
  const icons = ['📱', '🎬', '▶️', '🎨', '🔊'];
  tips.forEach((tip, i) => {
    const card = document.createElement('div');
    card.className = 'tip-card';
    card.innerHTML = `
      <div class="tip-icon">${icons[i % icons.length]}</div>
      <div>
        <div class="tip-title">${tip.title || ''}</div>
        <div class="tip-text">${tip.tip || ''}</div>
      </div>
    `;
    container.appendChild(card);
  });
  if (tips.length) { hide($('tips-empty')); show(container); }
}

function initTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${target}`));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== `tab-${target}`));
    });
  });
}

function initAuthPage() {
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('login-form').classList.toggle('hidden', tab !== 'login');
      $('signup-form').classList.toggle('hidden', tab !== 'signup');
    });
  });
  
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('login-email').value;
    const password = $('login-password').value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      $('login-error').textContent = error.message;
      show($('login-error'));
    } else {
      state.user = data.user;
      state.token = data.session.access_token;
      await loadProfile();
      updateHeaderAuth();
      updateStudioAuth();
      showPage('wolf-select');
    }
  });
}

async function openDashboard() {
  showPage('dashboard');
  $('dash-wolf-img').src = `/${state.wolf?.image || 'logo.svg'}`;
  $('dash-wolf-name').textContent = state.profile?.display_name || state.wolf?.artist || '';
  $('dash-promo-code').textContent = state.profile?.promo_code || '';
  try {
    const res = await fetch('/api/dashboard', { headers: { Authorization: `Bearer ${state.token}` } });
    const json = await res.json();
    if (res.ok) {
      $('dash-referrals').textContent = json.stats.referralCount;
      $('dash-referred-gens').textContent = json.stats.referredGenerations;
      $('dash-own-gens').textContent = json.stats.ownGenerations;
      $('dash-earnings').textContent = `$${json.stats.earningsEstimate}`;
    }
  } catch {}
}

// ─── Wolf Map ────────────────────────────────────────────────────────────────
function initWolfMap() {
  const mapBtn = $('wolf-map-btn');
  const backBtn = $('map-back-btn');
  if (mapBtn) mapBtn.onclick = () => showPage('wolf-map');
  if (backBtn) backBtn.onclick = () => showPage('studio');

  // Override showPage for wolf-map
  const originalShowPage = showPage;
  window.showPage = (name) => {
    if (name === 'wolf-map') {
      ['wolf-select', 'studio', 'dashboard', 'auth'].forEach(p => hide($(`${p}-page`)));
      show($('wolf-map-page'));
      state.page = 'wolf-map';
      renderWorldMap();
      checkLabelAccess();
    } else {
      hide($('wolf-map-page'));
      originalShowPage(name);
    }
  };
}

function checkLabelAccess() {
  const isLabel = state.profile?.role === 'member';
  const toggleWrap = $('label-toggle-wrap');
  const legendLabel = $('legend-label-item');
  
  if (isLabel) {
    show(toggleWrap);
    show(legendLabel);
  } else {
    hide(toggleWrap);
    hide(legendLabel);
  }
}

function renderWorldMap() {
  const wrap = $('world-map-svg-wrap');
  if (wrap.innerHTML.trim() !== '') return; // Already rendered

  // Simple World Map SVG
  wrap.innerHTML = `
    <svg viewBox="0 0 1000 500" xmlns="http://www.w3.org/2000/svg">
      <path d="M150,150 Q200,100 300,150 T450,200 T600,150 T800,250 T900,200 L900,400 Q800,450 600,400 T400,450 T200,400 Z" fill="#2a2a35" />
      <circle cx="200" cy="200" r="3" fill="#8888aa" class="lone-wolf-pulse" />
      <circle cx="450" cy="250" r="3" fill="#8888aa" class="lone-wolf-pulse" />
      <circle cx="700" cy="180" r="3" fill="#8888aa" class="lone-wolf-pulse" />
      <circle cx="850" cy="350" r="3" fill="#8888aa" class="lone-wolf-pulse" />
      <circle cx="300" cy="380" r="3" fill="#8888aa" class="lone-wolf-pulse" />
    </svg>
  `;

  // Simulate live activity
  setInterval(() => {
    if (state.page !== 'wolf-map') return;
    const x = Math.random() * 800 + 100;
    const y = Math.random() * 300 + 100;
    addMapPulse(x, y);
  }, 4000);
}

function addMapPulse(x, y) {
  const svg = document.querySelector('#world-map-svg-wrap svg');
  if (!svg) return;

  const isLabel = $('label-view-toggle')?.checked;
  const color = isLabel && Math.random() > 0.7 ? 'var(--accent)' : '#8888aa';
  const className = isLabel && Math.random() > 0.7 ? 'lightning-wolf-pulse' : 'lone-wolf-pulse';

  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", x);
  circle.setAttribute("cy", y);
  circle.setAttribute("r", "4");
  circle.setAttribute("fill", color);
  circle.classList.add(className);
  
  svg.appendChild(circle);
  
  // Show notification
  const names = ['Wolf_99', 'Alpha_User', 'Lone_Rider', 'Beat_Maker', 'Lyric_King'];
  const cities = ['London', 'Paris', 'New York', 'Berlin', 'Tokyo'];
  const name = names[Math.floor(Math.random() * names.length)];
  const city = cities[Math.floor(Math.random() * cities.length)];
  
  showMapNotification(name, city, isLabel && Math.random() > 0.7);

  setTimeout(() => circle.remove(), 10000);
}

function showMapNotification(name, city, isLabel) {
  const container = $('map-notifications');
  const notif = document.createElement('div');
  notif.className = 'map-notif';
  if (isLabel) notif.style.borderLeftColor = 'var(--accent)';
  
  notif.innerHTML = `
    <div class="notif-title">${isLabel ? '⚡ LIGHTNING STRIKE' : '🐺 NEW PACK GENERATED'}</div>
    <div class="notif-body">${name} just dropped a track in ${city}</div>
  `;
  
  container.appendChild(notif);
  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transform = 'translateX(100%)';
    setTimeout(() => notif.remove(), 500);
  }, 4000);
}

// ─── Mobile Nav ─────────────────────────────────────────────────────────────
function initMobileNav() {
  document.querySelectorAll('.mnav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) showPage(page);
    });
  });
}

function updateMobileNavActive(pageName) {
  document.querySelectorAll('.mnav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageName);
  });
}

async function init() {
  try {
    initCanvas();
    await initSupabase();
    await checkSession();
    initEliteHeader();
    initAuthPage();
    initWolfSelect();
    initTabs();
    initGenerate();
    initUpload();
    initMobileNav();
    const dashBack = $('dash-back-btn');
    if (dashBack) dashBack.onclick = () => showPage('wolf-select');
  } catch (err) {
    console.error('[init] crashed:', err);
  }
  showPage('wolf-select');
}

// ─── Elite Header Navigation ────────────────────────────────────────────────
function initEliteHeader() {
  // Nav links
  document.querySelectorAll('.elite-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      if (page) showPage(page);
    });
  });

  // Logo → home
  const logo = $('elite-logo-link');
  if (logo) logo.addEventListener('click', (e) => { e.preventDefault(); showPage('wolf-select'); });

  // Join the Pack → auth signup
  const joinBtn = $('elite-join-btn');
  if (joinBtn) joinBtn.addEventListener('click', () => {
    showPage('auth');
    document.querySelector('.auth-tab[data-tab="signup"]')?.click();
  });

  // Sign In
  const signinBtn = $('elite-signin-btn');
  if (signinBtn) signinBtn.addEventListener('click', () => {
    if (state.user) {
      // Sign out
      if (window.supabase) supabase.auth.signOut();
      state.user = null; state.token = null; state.profile = null;
      signinBtn.textContent = 'SIGN IN';
      const jb = $('elite-join-btn');
      if (jb) jb.style.display = '';
      showPage('wolf-select');
    } else {
      showPage('auth');
    }
  });
}

// ─── Wolf Hub & Tinder Logic ────────────────────────────────────────────────
function initWolfHub() {
  const hub = $('wolf-hub-page');
  if (!hub) return;

  $('hub-back-btn').onclick = () => showPage('studio');
  $('close-swipe-btn').onclick = () => {
    hide($('swipe-stack-container'));
    $('wolf-head-hub').classList.remove('howling');
  };
  $('pass-btn').onclick = () => swipeCard('left');
  $('howl-btn').onclick = () => swipeCard('right');
  $('start-collab-btn').onclick = () => hide($('match-overlay'));

  // Country Orbs
  document.querySelectorAll('.country-orb').forEach(orb => {
    orb.onclick = () => {
      const city = orb.dataset.city;
      triggerWolfMawTransition(city);
    };
  });
}

function triggerWolfMawTransition(city) {
  const head = $('wolf-head-hub');
  head.classList.add('howling');
  
  // Play howl sound if available
  // new Audio('/howl.mp3').play();

  setTimeout(() => {
    openSwipeStack(city);
  }, 800);
}

const mockWolves = [
  { id: 1, name: 'Wolf_99', genre: 'Drill', looking: 'Looking for a hard verse', lyrics: 'Concrete jungle where dreams are made of...' },
  { id: 2, name: 'Viper_X', genre: 'Afrobeats', looking: 'Need a melodic hook', lyrics: 'Rhythm in my soul, fire in my eyes...' },
  { id: 3, name: 'Ghost_Writer', genre: 'Dark Trap', looking: 'Collab on a dark beat', lyrics: 'Shadows in the night, moving out of sight...' },
  { id: 4, name: 'Luna_Soul', genre: 'R&B', looking: 'Smooth vocals only', lyrics: 'Under the moonlight, feeling so right...' }
];

function openSwipeStack(city) {
  $('current-swipe-city').innerText = city.toUpperCase();
  show($('swipe-stack-container'));
  renderCardStack();
}

function renderCardStack() {
  const stack = $('wolf-card-stack');
  stack.innerHTML = '';
  
  mockWolves.forEach((wolf, i) => {
    const card = document.createElement('div');
    card.className = 'wolf-profile-card versus-card';
    card.style.zIndex = mockWolves.length - i;
    card.style.position = 'absolute';
    card.style.top = '0';
    card.style.left = '0';
    card.style.opacity = i === 0 ? '1' : '0';
    card.style.transform = i === 0 ? 'translateX(0)' : 'translateX(100px)';
    card.style.transition = 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    
    card.innerHTML = `
      <div class="card-image-wrap">
        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${wolf.name}" class="card-img" />
        <div class="card-genre-tag">${wolf.genre}</div>
      </div>
      <div class="card-info">
        <div class="card-name">${wolf.name}</div>
        <div class="card-looking-for">${wolf.looking}</div>
        <div class="card-lyrics-preview">"${wolf.lyrics}"</div>
      </div>
    `;
    stack.appendChild(card);
  });
}

function swipeCard(direction) {
  const stack = $('wolf-card-stack');
  const card = stack.firstElementChild;
  if (!card) return;

  const x = direction === 'right' ? 1000 : -1000;
  card.style.transform = `translateX(${x}px) rotate(${direction === 'right' ? 30 : -30}deg)`;
  card.style.opacity = '0';

  if (direction === 'right') {
    // 1 in 3 chance of a match for demo
    if (Math.random() > 0.6) {
      setTimeout(() => {
        const name = card.querySelector('.card-name').innerText;
        $('match-name').innerText = name;
        show($('match-overlay'));
      }, 500);
    }
  }

  setTimeout(() => {
    card.remove();
    
    // Show next card
    const nextCard = stack.firstElementChild;
    if (nextCard) {
      nextCard.style.opacity = '1';
      nextCard.style.transform = 'translateX(0)';
    } else {
      setTimeout(() => {
        hide($('swipe-stack-container'));
        $('wolf-head-hub').classList.remove('howling');
      }, 500);
    }
  }, 300);
}

document.addEventListener('DOMContentLoaded', init);
