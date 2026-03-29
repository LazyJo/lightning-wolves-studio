/* ═══════════════════════════════════════════════════════════════════════════
   LIGHTNING WOLVES LYRICS STUDIO — Frontend Application
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Supabase client ─────────────────────────────────────────────────────────
// Injected from window via CDN; keys fetched from meta tags or config endpoint
// We proxy auth through the backend so the service role key stays server-side.
// The anon key + URL are safe to expose (RLS protects data).
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
    // Supabase not configured — guest-only mode
    console.info('Supabase not configured, running in guest mode');
  }
}

// ─── App State ───────────────────────────────────────────────────────────────
const state = {
  page: 'wolf-select',      // wolf-select | studio | dashboard | auth
  section: 'studio',        // studio | tracks | visuals | covers | the-pack
  wolf: null,               // { id, color, artist, genre, image }
  user: null,               // Supabase user object
  profile: null,            // DB profile row
  token: null,              // JWT for API calls
  lastPack: null,           // last generated result
  lastMeta: null,           // { title, artist, genre, wolfId }
  uploadedFile: null,       // { filename, originalName, size }
  generating: false,
};

// ─── DOM helpers ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const show = el => el && el.classList.remove('hidden');
const hide = el => el && el.classList.add('hidden');

function showPage(name) {
  // Hide all top-level pages
  ['wolf-select-page', 'app-shell', 'dashboard-page', 'auth-page'].forEach(id => {
    const el = $(id);
    if (el) hide(el);
  });

  // Map page names to top-level element ids
  const topPages = {
    'wolf-select': 'wolf-select-page',
    'dashboard': 'dashboard-page',
    'auth': 'auth-page',
  };

  if (topPages[name]) {
    const el = $(topPages[name]);
    if (el) show(el);
  } else {
    // Any section inside the app-shell (studio, tracks, visuals, covers, the-pack)
    show($('app-shell'));
    showSection(name);
  }
  state.page = name;
}

// ─── Section Navigation (inside app-shell) ───────────────────────────────
const APP_SECTIONS = ['studio', 'tracks', 'visuals', 'covers', 'the-pack'];

function showSection(name) {
  APP_SECTIONS.forEach(s => {
    const el = $(`${s}-page`);
    if (el) hide(el);
  });
  const el = $(`${name}-page`);
  if (el) show(el);
  state.section = name;

  // Update active nav link
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === name);
  });

  // Refresh data when entering section
  if (name === 'tracks') renderTracksList();
  if (name === 'visuals') renderVisualsGrid();
}

function updateNavVisibility() {
  const isMember = state.profile?.role === 'member';
  document.querySelectorAll('.nav-link.members-only').forEach(btn => {
    if (isMember) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  });

  // Upload zones: Visuals (Shiteux + Lazy Jo), Covers (Drippydesigns + Lazy Jo)
  const name = (state.profile?.display_name || '').toLowerCase();
  const wolfArtist = (state.wolf?.artist || '').toLowerCase();
  const canUploadVisuals = name === 'shiteux' || name === 'lazy jo' || wolfArtist === 'lazy jo';
  const canUploadCovers  = name === 'drippydesigns' || name === 'lazy jo' || wolfArtist === 'lazy jo';

  const vizUpload = $('visuals-upload-zone');
  const covUpload = $('covers-upload-zone');
  if (vizUpload) { canUploadVisuals && isMember ? show(vizUpload) : hide(vizUpload); }
  if (covUpload) { canUploadCovers && isMember ? show(covUpload) : hide(covUpload); }
}

function initNav() {
  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.nav;
      showSection(section);
    });
  });
  // Show/hide member-only links based on current role
  updateNavVisibility();
}

// ─── Lightning Particle Canvas ───────────────────────────────────────────────
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

  // Particles (drifting sparks)
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
      const color = getComputedStyle(document.documentElement)
        .getPropertyValue('--wolf-color').trim() || '#f5c518';
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
      ctx.shadowBlur = 6;
      ctx.shadowColor = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Lightning bolts (occasional flashes)
  class Bolt {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * W;
      this.y = 0;
      this.segments = [];
      const segs = Math.floor(Math.random() * 6 + 4);
      let cx = this.x, cy = 0;
      for (let i = 0; i < segs; i++) {
        cx += (Math.random() - 0.5) * 60;
        cy += H / segs;
        this.segments.push({ x: cx, y: cy });
      }
      this.life = 1;
      this.decay = Math.random() * 0.06 + 0.04;
      const color = getComputedStyle(document.documentElement)
        .getPropertyValue('--wolf-color').trim() || '#f5c518';
      this.color = color;
    }
    update() { this.life -= this.decay; }
    draw() {
      if (this.life <= 0) return;
      ctx.save();
      ctx.globalAlpha = this.life * 0.08;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 12;
      ctx.shadowColor = this.color;
      ctx.beginPath();
      ctx.moveTo(this.x, 0);
      this.segments.forEach(s => ctx.lineTo(s.x, s.y));
      ctx.stroke();
      ctx.restore();
    }
  }

  // Init particles
  for (let i = 0; i < 80; i++) particles.push(new Particle());

  let boltTimer = 0;
  function loop() {
    ctx.clearRect(0, 0, W, H);

    // Particles
    particles.forEach(p => { p.update(); p.draw(); });

    // Bolts
    boltTimer++;
    if (boltTimer > 120 + Math.random() * 180) {
      bolts.push(new Bolt());
      boltTimer = 0;
    }
    bolts = bolts.filter(b => b.life > 0);
    bolts.forEach(b => { b.update(); b.draw(); });

    requestAnimationFrame(loop);
  }
  loop();
}

// ─── Wolf Theme ───────────────────────────────────────────────────────────────
function applyWolfTheme(color) {
  document.documentElement.style.setProperty('--wolf-color', color);
  document.documentElement.style.setProperty('--accent', color);
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
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', state.user.id)
    .single();
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
    actionsEl.innerHTML = `
      <button class="btn-outline btn-sm" id="header-signin">Sign In</button>
    `;
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

  const badge = $('studio-plan-badge');
  if (badge) {
    if (state.profile?.role === 'member') {
      badge.textContent = 'WOLF PACK';
      badge.className = 'plan-badge member';
    } else {
      badge.textContent = isLoneWolf() ? 'LONE WOLF' : (state.user ? 'FREE' : 'PUBLIC');
      badge.className = isLoneWolf() ? 'plan-badge lone-wolf' : 'plan-badge';
    }
  }

  // Update nav visibility for member-only links
  updateNavVisibility();

  // If non-member is on a members-only section, bounce to studio
  const isMember = state.profile?.role === 'member';
  if (!isMember && state.section !== 'studio') {
    showSection('studio');
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

// ─── Auth Forms ───────────────────────────────────────────────────────────────
function initAuthPage() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (tab === 'login') {
        show($('login-form')); hide($('signup-form'));
      } else {
        hide($('login-form')); show($('signup-form'));
      }
    });
  });

  // Switch links inside forms
  document.querySelectorAll('[data-switch]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = e.target.dataset.switch;
      document.querySelector(`.auth-tab[data-tab="${target}"]`)?.click();
    });
  });

  // Login
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('login-email').value.trim();
    const pass  = $('login-password').value;
    const errEl = $('login-error');
    hide(errEl);
    if (!supabase) return showAuthError(errEl, 'Auth not configured. Please set up Supabase.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) return showAuthError(errEl, error.message);
    state.user  = data.user;
    state.token = data.session.access_token;
    await loadProfile();
    afterAuth();
  });

  // Signup
  $('signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('signup-email').value.trim();
    const pass  = $('signup-password').value;
    const promo = $('signup-promo').value.trim().toUpperCase();
    const errEl = $('signup-error');
    hide(errEl);

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, promoCode: promo }),
    });
    const json = await res.json();
    if (!res.ok) return showAuthError(errEl, json.error);

    // Auto sign-in
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) return showAuthError(errEl, 'Account created! Please sign in.');
      state.user  = data.user;
      state.token = data.session.access_token;
      await loadProfile();
    }
    afterAuth();
  });

  // Guest
  $('continue-as-guest').addEventListener('click', () => {
    showPage('wolf-select');
  });
}

function showAuthError(el, msg) {
  el.textContent = msg;
  show(el);
}

function afterAuth() {
  updateHeaderAuth();
  updateStudioAuth();
  if (state.wolf) {
    showPage('studio');
  } else {
    showPage('wolf-select');
  }
}

// ─── Wolf Selection ───────────────────────────────────────────────────────────
function initWolfSelect() {
  document.querySelectorAll('.wolf-card.active').forEach(card => {
    card.addEventListener('click', () => {
      const wolf = {
        id:     card.dataset.wolf,
        color:  card.dataset.color,
        artist: card.dataset.artist,
        genre:  card.dataset.genre,
        image:  card.dataset.image,
      };
      selectWolf(wolf);
    });
  });

  $('enter-lone-wolf').addEventListener('click', () => {
    selectWolf({ id: 'lone-wolf', color: '#9E9E9E', artist: '', genre: '', image: 'wolf-gray.svg' });
  });
}

function selectWolf(wolf) {
  state.wolf = wolf;
  applyWolfTheme(wolf.color);
  loadStudio(wolf);
  showPage('studio');
  updateNavVisibility();
}

// ─── Studio Setup ─────────────────────────────────────────────────────────────
function loadStudio(wolf) {
  // Header
  const img = $('studio-wolf-img');
  if (img) img.src = `/${wolf.image || 'logo.svg'}`;
  const dotEl = $('studio-artist-dot');
  if (dotEl) dotEl.style.background = wolf.color;
  if (dotEl) dotEl.style.boxShadow  = `0 0 8px ${wolf.color}`;
  const nameEl = $('studio-artist-name');
  if (nameEl) nameEl.textContent = wolf.artist || '';

  // Pre-fill artist field if wolf selected
  if (wolf.artist) {
    const artistInput = $('song-artist');
    if (artistInput && !artistInput.value) artistInput.value = wolf.artist;
  }

  // Pre-select genre
  if (wolf.genre) {
    const genreSelect = $('song-genre');
    if (genreSelect) {
      for (const opt of genreSelect.options) {
        if (opt.value === wolf.genre || wolf.genre.includes(opt.value)) {
          genreSelect.value = opt.value;
          break;
        }
      }
    }
  }

  // Update auth UI
  updateStudioAuth();

  // Restore last pack from localStorage
  const saved = localStorage.getItem('lw_last_pack');
  const savedMeta = localStorage.getItem('lw_last_meta');
  if (saved && savedMeta) {
    try {
      state.lastPack = JSON.parse(saved);
      state.lastMeta = JSON.parse(savedMeta);
      renderPack(state.lastPack, state.lastMeta);
    } catch { /* ignore */ }
  }

  // Wolf-themed focus glow on inputs
  document.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('focus', () => {
      el.style.boxShadow = `0 0 0 3px ${wolf.color}22`;
    });
    el.addEventListener('blur', () => {
      el.style.boxShadow = '';
    });
  });
}

// ─── File Upload ──────────────────────────────────────────────────────────────
function initUpload() {
  const zone  = $('upload-zone');
  const input = $('file-input');
  const info  = $('upload-info');

  zone.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    if (input.files[0]) handleFile(input.files[0]);
  });

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('dragover');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  async function handleFile(file) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    info.textContent = `Uploading ${file.name} (${sizeMB} MB)…`;
    show(info);

    const fd = new FormData();
    fd.append('file', file);
    try {
      const res  = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      state.uploadedFile = json;
      info.textContent   = `✓ ${json.originalName} · ${sizeMB} MB`;
      info.style.color   = '#3ddc84';
    } catch (err) {
      info.textContent = `Upload failed: ${err.message}`;
      info.style.color = '#ff4455';
    }
  }
}

// ─── Generate ─────────────────────────────────────────────────────────────────
function initGenerate() {
  $('generate-btn').addEventListener('click', generate);
}

async function generate() {
  const title    = $('song-title').value.trim();
  const artist   = $('song-artist').value.trim();
  const genre    = $('song-genre').value;
  const bpm      = $('song-bpm').value.trim();
  const language = $('song-language').value;
  const mood     = $('song-mood').value.trim();
  const errEl    = $('gen-error');

  hide(errEl);

  if (!title || !artist || !genre) {
    errEl.textContent = 'Please fill in Song Title, Artist Name, and Genre.';
    show(errEl);
    return;
  }

  // Lone Wolf local limit check
  if (checkLoneWolfLimit()) {
    showUpgradeModal();
    return;
  }

  if (state.generating) return;
  state.generating = true;

  const btn = $('generate-btn');
  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = 'GENERATING…';

  // Show waveform
  show($('waveform-wrap'));
  hide($('summary-card'));

  // Clear tabs
  clearResults();

  try {
    const body = { title, artist, genre, language, wolfId: state.wolf?.id };
    if (bpm)   body.bpm  = bpm;
    if (mood)  body.mood = mood;
    if (state.token) body.token = state.token;

    const res  = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      if (json.error === 'LIMIT_REACHED') {
        show($('limit-modal'));
        return;
      }
      throw new Error(json.error || 'Generation failed');
    }

    state.lastPack = json.pack;
    state.lastMeta = json.meta;

    // Save to localStorage
    localStorage.setItem('lw_last_pack', JSON.stringify(json.pack));
    localStorage.setItem('lw_last_meta', JSON.stringify(json.meta));

    // Track Lone Wolf generation count
    if (isLoneWolf()) incrementLoneWolfGenCount();

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
}

function clearResults() {
  hide($('lyrics-content'));  show($('lyrics-empty'));
  hide($('srt-content'));     show($('srt-empty'));
  hide($('beats-content'));   show($('beats-empty'));
  hide($('prompts-content')); show($('prompts-empty'));
  hide($('tips-content'));    show($('tips-empty'));
  $('lyrics-content').innerHTML = '';
  $('beats-tbody').innerHTML    = '';
  $('prompts-content').innerHTML = '';
  $('tips-content').innerHTML    = '';
}

// ─── Render Results ───────────────────────────────────────────────────────────
function renderPack(pack, meta) {
  // Summary card
  const sc = $('summary-card');
  const wolfImg = $('summary-wolf-img');
  if (wolfImg) wolfImg.src = `/${state.wolf?.image || 'logo.svg'}`;
  $('summary-title').textContent  = meta.title || '';
  $('summary-artist').textContent = meta.artist || '';
  $('summary-genre').textContent  = meta.genre  || '';
  show(sc);

  // Lyrics
  renderLyrics(pack.lyrics || []);

  // SRT
  if (pack.srt) {
    $('srt-text').textContent = pack.srt;
    hide($('srt-empty')); show($('srt-content'));
  }

  // Beats
  renderBeats(pack.beats || []);

  // Prompts
  renderPrompts(pack.prompts || []);

  // Tips
  renderTips(pack.tips || []);
}

function renderLyrics(lyrics) {
  const container = $('lyrics-content');
  container.innerHTML = '';
  let hasContent = false;

  lyrics.forEach(line => {
    hasContent = true;
    const text = line.text || '';
    const isSectionHeader = /^\[.+\]$/.test(text.trim());

    if (isSectionHeader) {
      const div = document.createElement('div');
      div.className = 'lyric-section-header';
      div.textContent = text.replace(/[\[\]]/g, '');
      container.appendChild(div);
    } else {
      const row = document.createElement('div');
      row.className = 'lyric-row';
      row.innerHTML = `
        <span class="lyric-ts">${line.ts || ''}</span>
        <span class="lyric-text">${escapeHTML(text)}</span>
      `;
      container.appendChild(row);
    }
  });

  if (hasContent) { hide($('lyrics-empty')); show(container); }
}

function renderBeats(beats) {
  const tbody = $('beats-tbody');
  tbody.innerHTML = '';

  beats.forEach(beat => {
    const tr = document.createElement('tr');
    const typeClass = `beat-type-${beat.type || 'CUT'}`;
    tr.innerHTML = `
      <td class="beat-ts">${escapeHTML(beat.ts || '')}</td>
      <td>${escapeHTML(beat.label || '')}</td>
      <td><span class="beat-type-badge ${typeClass}">${escapeHTML(beat.type || 'CUT')}</span></td>
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
      <div class="prompt-section-name">${escapeHTML(p.section || '')}</div>
      <div class="prompt-text" id="prompt-text-${i}">${escapeHTML(p.prompt || '')}</div>
      <button class="prompt-copy-btn" data-idx="${i}">Copy</button>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('.prompt-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx  = parseInt(btn.dataset.idx);
      const text = prompts[idx]?.prompt || '';
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });
  });

  if (prompts.length) { hide($('prompts-empty')); show(container); }
}

const TIP_ICONS = ['📱', '🎬', '▶️', '🎨', '🔊', '💡', '🌟', '🎯'];

function renderTips(tips) {
  const container = $('tips-content');
  container.innerHTML = '';

  tips.forEach((tip, i) => {
    const card = document.createElement('div');
    card.className = 'tip-card';
    card.innerHTML = `
      <div class="tip-icon">${TIP_ICONS[i % TIP_ICONS.length]}</div>
      <div>
        <div class="tip-title">${escapeHTML(tip.title || '')}</div>
        <div class="tip-text">${escapeHTML(tip.tip || '')}</div>
      </div>
    `;
    container.appendChild(card);
  });

  if (tips.length) { hide($('tips-empty')); show(container); }
}

// ─── Tracks (localStorage persistence) ───────────────────────────────────────
const LW_TRACKS_KEY = 'lw_saved_tracks';

function getSavedTracks() {
  try { return JSON.parse(localStorage.getItem(LW_TRACKS_KEY)) || []; }
  catch { return []; }
}

function saveTracks(tracks) {
  localStorage.setItem(LW_TRACKS_KEY, JSON.stringify(tracks));
}

function saveCurrentTrack() {
  if (!state.lastPack || !state.lastMeta) return;
  const tracks = getSavedTracks();
  const track = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: state.lastMeta.title,
    artist: state.lastMeta.artist,
    genre: state.lastMeta.genre,
    wolfId: state.lastMeta.wolfId || state.wolf?.id,
    date: new Date().toISOString(),
    pack: state.lastPack,
    meta: state.lastMeta,
  };
  tracks.unshift(track);
  saveTracks(tracks);

  // Visual feedback
  const btn = $('save-track-btn');
  if (btn) {
    btn.textContent = 'Saved!';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = 'Save to Tracks'; btn.disabled = false; }, 2000);
  }
}

function deleteTrack(id) {
  const tracks = getSavedTracks().filter(t => t.id !== id);
  saveTracks(tracks);
  renderTracksList();
}

function loadTrack(id) {
  const tracks = getSavedTracks();
  const track = tracks.find(t => t.id === id);
  if (!track) return;

  state.lastPack = track.pack;
  state.lastMeta = track.meta;
  localStorage.setItem('lw_last_pack', JSON.stringify(track.pack));
  localStorage.setItem('lw_last_meta', JSON.stringify(track.meta));

  // Switch to studio and render
  showSection('studio');
  renderPack(track.pack, track.meta);
}

function renderTracksList() {
  const tracks = getSavedTracks();
  const listEl = $('tracks-list');
  const emptyEl = $('tracks-empty');

  if (!tracks.length) {
    hide(listEl); show(emptyEl);
    return;
  }

  hide(emptyEl); show(listEl);
  listEl.innerHTML = '';

  tracks.forEach(track => {
    const date = new Date(track.date);
    const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const row = document.createElement('div');
    row.className = 'track-row';
    row.innerHTML = `
      <div class="track-info" data-load="${track.id}">
        <div class="track-title">${escapeHTML(track.title)}</div>
        <div class="track-meta">
          <span>${escapeHTML(track.artist)}</span>
          <span class="track-genre-badge">${escapeHTML(track.genre)}</span>
          <span class="track-date">${dateStr}</span>
        </div>
      </div>
      <button class="btn-ghost btn-sm track-delete" data-delete="${track.id}" title="Delete track">✕</button>
    `;
    listEl.appendChild(row);
  });

  // Wire click handlers
  listEl.querySelectorAll('[data-load]').forEach(el => {
    el.addEventListener('click', () => loadTrack(el.dataset.load));
  });
  listEl.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteTrack(btn.dataset.delete);
    });
  });
}

function initTracks() {
  $('save-track-btn').addEventListener('click', saveCurrentTrack);
}

// ─── Visuals (localStorage gallery) ──────────────────────────────────────────
const LW_VISUALS_KEY = 'lw_visuals';

function getVisuals() {
  try { return JSON.parse(localStorage.getItem(LW_VISUALS_KEY)) || []; }
  catch { return []; }
}

function saveVisuals(items) {
  localStorage.setItem(LW_VISUALS_KEY, JSON.stringify(items));
}

function deleteVisual(id) {
  const items = getVisuals().filter(v => v.id !== id);
  saveVisuals(items);
  renderVisualsGrid();
}

function canUploadVisuals() {
  const name = (state.profile?.display_name || '').toLowerCase();
  const wolfArtist = (state.wolf?.artist || '').toLowerCase();
  return name === 'shiteux' || name === 'lazy jo' || wolfArtist === 'lazy jo';
}

function renderVisualsGrid() {
  const items = getVisuals();
  const gridEl = $('visuals-grid');
  const emptyEl = $('visuals-empty');

  if (!items.length) {
    hide(gridEl); show(emptyEl);
    return;
  }

  hide(emptyEl); show(gridEl);
  gridEl.innerHTML = '';

  const canDelete = canUploadVisuals();

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'gallery-card';

    const isVideo = item.type === 'video';
    const mediaHTML = isVideo
      ? `<video class="gallery-media" src="${item.data}" preload="metadata" muted></video>
         <div class="gallery-play-badge">▶</div>`
      : `<img class="gallery-media" src="${item.data}" alt="${escapeHTML(item.name)}" loading="lazy" />`;

    card.innerHTML = `
      <div class="gallery-media-wrap">${mediaHTML}</div>
      <div class="gallery-card-footer">
        ${item.wolf ? `<span class="gallery-wolf-tag">${escapeHTML(item.wolf)}</span>` : ''}
        <span class="gallery-item-name">${escapeHTML(item.name)}</span>
        ${canDelete ? `<button class="btn-ghost btn-sm gallery-delete" data-del-visual="${item.id}" title="Delete">✕</button>` : ''}
      </div>
    `;
    gridEl.appendChild(card);

    // Video click-to-play
    if (isVideo) {
      const video = card.querySelector('video');
      const badge = card.querySelector('.gallery-play-badge');
      card.querySelector('.gallery-media-wrap').addEventListener('click', () => {
        if (video.paused) { video.play(); hide(badge); }
        else { video.pause(); show(badge); }
      });
    }
  });

  // Wire delete
  gridEl.querySelectorAll('[data-del-visual]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteVisual(btn.dataset.delVisual);
    });
  });
}

function initVisuals() {
  const fileInput = $('visuals-file-input');
  const pickBtn = $('visuals-pick-btn');
  const uploadBtn = $('visuals-upload-btn');
  const previewEl = $('visuals-preview');
  let pendingFiles = [];

  pickBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    pendingFiles = Array.from(fileInput.files);
    if (!pendingFiles.length) { hide(previewEl); uploadBtn.disabled = true; return; }

    previewEl.innerHTML = '';
    pendingFiles.forEach(f => {
      const tag = document.createElement('span');
      tag.className = 'gallery-preview-tag';
      tag.textContent = f.name;
      previewEl.appendChild(tag);
    });
    show(previewEl);
    uploadBtn.disabled = false;
  });

  uploadBtn.addEventListener('click', () => {
    if (!pendingFiles.length) return;
    const wolf = $('visuals-tag-wolf').value;
    let processed = 0;

    pendingFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const items = getVisuals();
        items.unshift({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: file.name,
          type: file.type.startsWith('video') ? 'video' : 'photo',
          wolf: wolf || '',
          data: reader.result,
          date: new Date().toISOString(),
        });
        saveVisuals(items);
        processed++;
        if (processed === pendingFiles.length) {
          pendingFiles = [];
          fileInput.value = '';
          hide(previewEl);
          uploadBtn.disabled = true;
          renderVisualsGrid();
        }
      };
      reader.readAsDataURL(file);
    });
  });
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.remove('active');
        p.classList.add('hidden');
      });
      const panel = $(`tab-${target}`);
      if (panel) {
        panel.classList.remove('hidden');
        panel.classList.add('active');
      }
    });
  });
}

// ─── Downloads ────────────────────────────────────────────────────────────────
function initDownloads() {
  $('download-srt').addEventListener('click', () => {
    const text     = $('srt-text').textContent;
    const filename = `${state.lastMeta?.title || 'lyrics'}.srt`;
    downloadText(text, filename, 'text/plain');
  });

  $('export-beats').addEventListener('click', () => {
    const rows  = document.querySelectorAll('#beats-tbody tr');
    let txt = 'TIMESTAMP\tLABEL\tTYPE\n';
    rows.forEach(tr => {
      const cells = tr.querySelectorAll('td');
      txt += `${cells[0].textContent}\t${cells[1].textContent}\t${cells[2].textContent.trim()}\n`;
    });
    const filename = `${state.lastMeta?.title || 'beats'}-cuts.txt`;
    downloadText(txt, filename, 'text/plain');
  });
}

function downloadText(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── New Track ────────────────────────────────────────────────────────────────
function initNewTrack() {
  $('new-track-btn').addEventListener('click', () => {
    // Clear inputs
    $('song-title').value  = '';
    $('song-bpm').value    = '';
    $('song-mood').value   = '';
    const info = $('upload-info');
    hide(info);
    state.uploadedFile = null;
    state.lastPack     = null;
    state.lastMeta     = null;
    localStorage.removeItem('lw_last_pack');
    localStorage.removeItem('lw_last_meta');
    hide($('summary-card'));
    clearResults();
    hide($('gen-error'));
  });
}

// ─── Change Wolf ─────────────────────────────────────────────────────────────
function initChangeWolf() {
  $('change-wolf-btn').addEventListener('click', () => {
    showPage('wolf-select');
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function openDashboard() {
  if (!state.user || state.profile?.role !== 'member') return;

  showPage('dashboard');

  // Set wolf image
  const img = $('dash-wolf-img');
  if (img && state.wolf?.image) img.src = `/${state.wolf.image}`;
  const nameEl = $('dash-wolf-name');
  if (nameEl) nameEl.textContent = state.profile?.display_name || state.wolf?.artist || '';

  const promoEl = $('dash-promo-code');
  if (promoEl) promoEl.textContent = state.profile?.promo_code || '';

  // Fetch stats
  try {
    const res  = await fetch('/api/dashboard', {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const json = await res.json();
    if (res.ok) {
      $('dash-referrals').textContent    = json.stats.referralCount;
      $('dash-referred-gens').textContent = json.stats.referredGenerations;
      $('dash-own-gens').textContent     = json.stats.ownGenerations;
      $('dash-earnings').textContent     = `$${json.stats.earningsEstimate}`;
    }
  } catch { /* offline */ }
}

function initDashboard() {
  $('dash-back-btn').addEventListener('click', () => showPage('studio'));
  $('dash-signout-btn').addEventListener('click', signOut);
}

// ─── Lone Wolf Generation Tracking ───────────────────────────────────────────
const LONE_WOLF_LIMIT = 3;
const LW_GEN_KEY = 'lw_lone_wolf_gens';

function getLoneWolfGenCount() {
  const stored = localStorage.getItem(LW_GEN_KEY);
  if (!stored) return 0;
  try {
    const data = JSON.parse(stored);
    // Reset monthly — check if same month
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth()}`;
    if (data.month !== key) return 0;
    return data.count || 0;
  } catch { return 0; }
}

function incrementLoneWolfGenCount() {
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth()}`;
  const count = getLoneWolfGenCount() + 1;
  localStorage.setItem(LW_GEN_KEY, JSON.stringify({ month: key, count }));
  return count;
}

function isLoneWolf() {
  return !state.user && state.wolf?.id === 'lone-wolf';
}

function checkLoneWolfLimit() {
  if (!isLoneWolf()) return false; // no limit for members
  return getLoneWolfGenCount() >= LONE_WOLF_LIMIT;
}

// ─── Upgrade Modal ───────────────────────────────────────────────────────────
function showUpgradeModal() {
  show($('upgrade-modal'));
}

function initUpgradeModal() {
  $('upgrade-close').addEventListener('click', () => hide($('upgrade-modal')));
  $('upgrade-signup').addEventListener('click', () => {
    hide($('upgrade-modal'));
    showPage('auth');
    document.querySelector('.auth-tab[data-tab="signup"]')?.click();
  });
}

// ─── Limit Modal (legacy server-side) ────────────────────────────────────────
function initModal() {
  $('modal-close').addEventListener('click', () => hide($('limit-modal')));
  $('modal-signup').addEventListener('click', () => {
    hide($('limit-modal'));
    showPage('auth');
    document.querySelector('.auth-tab[data-tab="signup"]')?.click();
  });
}

// ─── Utility ─────────────────────────────────────────────────────────────────
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function init() {
  // Canvas always runs
  initCanvas();

  // Init Supabase (non-blocking)
  await initSupabase();

  // Check for existing session
  await checkSession();

  // Update header auth display
  updateHeaderAuth();

  // Wire up pages
  initAuthPage();
  initWolfSelect();
  initNav();
  initTabs();
  initGenerate();
  initUpload();
  initDownloads();
  initNewTrack();
  initChangeWolf();
  initTracks();
  initVisuals();
  initDashboard();
  initModal();
  initUpgradeModal();

  // Listen for Supabase auth state changes
  if (supabase) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        state.user  = session.user;
        state.token = session.access_token;
        await loadProfile();
      } else {
        state.user    = null;
        state.token   = null;
        state.profile = null;
      }
      updateHeaderAuth();
      updateStudioAuth();
    });
  }

  // Show wolf select as starting page
  showPage('wolf-select');
}

document.addEventListener('DOMContentLoaded', init);
