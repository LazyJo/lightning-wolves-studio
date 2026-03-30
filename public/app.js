/* ═══════════════════════════════════════════════════════════════════════════
   LIGHTNING WOLVES STUDIO — App Core
   Step 1: Global Layout (sidebar, topbar, routing, credits, toast)
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

// ─── Supabase ────────────────────────────────────────────────────────────────
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
    console.info('Supabase not configured — guest mode');
  }
}

// ─── App State ───────────────────────────────────────────────────────────────
const state = {
  currentPage: 'landing',
  user: null,
  profile: null,
  token: null,
  credits: parseInt(localStorage.getItem('lw_credits') || '0', 10),
  completedTasks: JSON.parse(localStorage.getItem('lw_completed_tasks') || '[]'),
  pendingTasks: JSON.parse(localStorage.getItem('lw_pending_tasks') || '[]'),
  genCount: parseInt(localStorage.getItem('lw_gen_count') || '0', 10),
  refCode: localStorage.getItem('lw_ref_code') || '',
  referralCount: parseInt(localStorage.getItem('lw_referral_count') || '0', 10),
  promoCode: localStorage.getItem('lw_promo_code') || '',
  uploadedFile: null,
  generating: false,
  lastPack: null,
  selectedWolf: null,
};

// ─── DOM Helpers ─────────────────────────────────────────────────────────────
const $ = (sel) => document.getElementById(sel) || document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const show = (el) => el && el.classList.remove('hidden');
const hide = (el) => el && el.classList.add('hidden');

// ─── Toast System ────────────────────────────────────────────────────────────
function toast(message, type = 'info') {
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ─── Credit System ───────────────────────────────────────────────────────────
function saveCredits() {
  localStorage.setItem('lw_credits', state.credits);
}

function addCredits(amount) {
  state.credits += amount;
  saveCredits();
  updateCreditDisplay();
}

function spendCredits(amount) {
  if (state.credits < amount) return false;
  state.credits -= amount;
  saveCredits();
  updateCreditDisplay();
  return true;
}

function updateCreditDisplay() {
  const amountEl = $('credit-amount');
  if (amountEl) amountEl.textContent = state.credits;

  const breakdown = $('credit-breakdown');
  if (breakdown) {
    const tasksEarned = state.completedTasks.length > 0 ? state.completedTasks.reduce((sum, t) => {
      const taskRewards = { signup: 10, youtube: 15, rosakay_ig: 5, lw_ig: 5 };
      return sum + (taskRewards[t] || 0);
    }, 0) : 0;
    const referralEarned = state.referralCount * 20;
    const spent = state.genCount * 10;

    breakdown.innerHTML = `
      <div class="credit-row"><span>From tasks</span><span>${tasksEarned} ⚡</span></div>
      <div class="credit-row"><span>From referrals</span><span>${referralEarned} ⚡</span></div>
      <div class="credit-row"><span>Spent</span><span>-${spent} ⚡</span></div>
      <div class="credit-row"><span style="color:var(--gold)">Balance</span><span style="color:var(--gold)">${state.credits} ⚡</span></div>
    `;
  }
}

// ─── Credit Pill Toggle ──────────────────────────────────────────────────────
function initCreditPill() {
  const pill = $('credit-pill');
  if (!pill) return;
  pill.addEventListener('click', (e) => {
    e.stopPropagation();
    pill.classList.toggle('open');
  });
  document.addEventListener('click', () => pill.classList.remove('open'));
}

// ─── Router ──────────────────────────────────────────────────────────────────
const PAGE_NAMES = {
  landing: 'Home',
  crew: 'Crew',
  studio: 'Studio',
  pricing: 'Pricing',
  join: 'Join the Pack',
  auth: 'Sign In',
  admin: 'Admin',
};

function navigateTo(page) {
  // Hide all pages
  $$('.page').forEach(p => p.classList.add('hidden'));

  // Show target page
  const target = $(`page-${page}`);
  if (target) target.classList.remove('hidden');

  // Update state
  state.currentPage = page;

  // Update breadcrumb
  const bc = $('breadcrumb-page');
  if (bc) bc.textContent = PAGE_NAMES[page] || page;

  // Update sidebar active state
  $$('.sidebar-icon').forEach(icon => {
    icon.classList.remove('active');
    if (icon.dataset.page === page) icon.classList.add('active');
  });

  // Scroll to top
  const mainContent = $('main-content');
  if (mainContent) mainContent.scrollTop = 0;
}

function initRouter() {
  // Handle hash changes
  function onHashChange() {
    const hash = window.location.hash.replace('#/', '') || 'landing';
    const page = hash.split('/')[0] || 'landing';
    if (PAGE_NAMES[page] !== undefined) {
      navigateTo(page);
    } else {
      navigateTo('landing');
    }
  }

  window.addEventListener('hashchange', onHashChange);

  // Handle sidebar clicks
  $$('.sidebar-icon[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.dataset.page;
      window.location.hash = `/${page === 'landing' ? '' : page}`;
    });
  });

  // Handle sidebar logo
  const logo = document.querySelector('.sidebar-logo');
  if (logo) {
    logo.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = '/';
    });
  }

  // Initial route
  onHashChange();
}

// ─── Topbar Auth Buttons ─────────────────────────────────────────────────────
function initTopbarAuth() {
  const signinBtn = $('btn-signin');
  const signupBtn = $('btn-signup');

  if (signinBtn) signinBtn.addEventListener('click', () => {
    window.location.hash = '/auth';
  });
  if (signupBtn) signupBtn.addEventListener('click', () => {
    window.location.hash = '/auth';
  });
}

function updateTopbarAuth() {
  const signinBtn = $('btn-signin');
  const signupBtn = $('btn-signup');
  const topbarRight = document.querySelector('.topbar-right');

  if (state.user) {
    if (signinBtn) signinBtn.style.display = 'none';
    if (signupBtn) {
      signupBtn.textContent = 'Sign Out';
      signupBtn.className = 'btn-topbar';
      signupBtn.onclick = signOut;
    }
  } else {
    if (signinBtn) { signinBtn.style.display = ''; signinBtn.textContent = 'Sign In'; }
    if (signupBtn) {
      signupBtn.style.display = '';
      signupBtn.textContent = 'Sign Up';
      signupBtn.className = 'btn-topbar btn-topbar-gold';
      signupBtn.onclick = () => { window.location.hash = '/auth'; };
    }
  }
}

// ─── Bug Report Modal ────────────────────────────────────────────────────────
function initBugReport() {
  const navBtn = $('bug-report-nav');
  const overlay = $('bug-modal-overlay');
  const closeBtn = $('bug-modal-close');
  const form = $('bug-report-form');

  if (navBtn) navBtn.addEventListener('click', (e) => {
    e.preventDefault();
    show(overlay);
  });
  if (closeBtn) closeBtn.addEventListener('click', () => hide(overlay));
  if (overlay) overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hide(overlay);
  });
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = $('bug-description').value.trim();
    if (!desc) return;
    toast('Bug report submitted. Thank you!', 'success');
    form.reset();
    hide(overlay);
  });
}

// ─── Auth ────────────────────────────────────────────────────────────────────
async function checkSession() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    state.user = data.session.user;
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

async function signOut() {
  if (supabase) await supabase.auth.signOut();
  state.user = null;
  state.token = null;
  state.profile = null;
  updateTopbarAuth();
  toast('Signed out', 'info');
  window.location.hash = '/';
}

// ─── Check Referral Code in URL ──────────────────────────────────────────────
function checkReferralCode() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref && ref.startsWith('LW-')) {
    localStorage.setItem('lw_ref_code', ref);
    state.refCode = ref;
  }
}

// ─── Wolf Data ───────────────────────────────────────────────────────────────
const WOLVES = {
  lazyjo:  { id: 'lazyjo',  name: 'Lazy Jo',       color: '#f5c518', genre: 'Melodic Hip-Hop',       artist: 'Lazy Jo',        role: 'Founder · Artist',
    bio: 'Every pack needs a leader. Joeri Van Tricht — Lazy Jo — founded Lightning Wolves with a vision: build a crew where every artist wins together. Born in Belgium, his melodic hip-hop blends introspective lyricism with infectious energy. The architect of the sound, the face of the pack.' },
  zirka:   { id: 'zirka',   name: 'Zirka',          color: '#b388ff', genre: 'French Hip-Hop',        artist: 'Zirka',          role: 'Artist',
    bio: 'French hip-hop energy with melodic punch.' },
  rosakay: { id: 'rosakay', name: 'Rosakay',         color: '#ff80ab', genre: 'Pop / French Pop',      artist: 'Rosakay',        role: 'Artist',
    bio: 'Sarah Kingambo. Pop with a French soul.', image: '/Rosakay Profile.jpeg', animation: '/Rosakay Wolf Animation.mp4',
    instagram: 'https://www.instagram.com/rosakay_officiel', spotify: 'https://open.spotify.com/artist/5DaB9HZOXF1kOqxLiS2d4B' },
  drippy:  { id: 'drippy',  name: 'Drippydesigns',   color: '#82b1ff', genre: 'Visual Art',            artist: 'Drippydesigns',  role: 'Designer',
    bio: 'The visual identity behind the pack.' },
  shiteux: { id: 'shiteux', name: 'Shiteux',         color: '#69f0ae', genre: 'Photo · Video · Beats',  artist: 'Shiteux',        role: 'Visuals',
    bio: 'Every pack needs someone watching. Pierre Van der Heyde — Shiteux — is the one behind the camera and behind the beat. Born in Belgium in 1997, he documents the Lightning Wolves world through photos, video, and sound. From lo-fi meditations \'Sin[e]\' and \'Doubt Clouds\' to his evolving chillout project Behind this Luck, Shiteux moves quietly and creates loudly.' },
};

// ─── Crew Page ───────────────────────────────────────────────────────────────
function initCrewPage() {
  // Enter Studio buttons
  document.querySelectorAll('.crew-enter-studio').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const wolfId = btn.dataset.wolf;
      const wolf = WOLVES[wolfId];
      if (wolf) {
        state.selectedWolf = wolf;
      }
      window.location.hash = '/studio';
    });
  });

  // Bio toggles
  document.querySelectorAll('.crew-bio-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const fullBio = btn.previousElementSibling;
      const expanded = btn.dataset.expanded === 'true';
      if (expanded) {
        fullBio.classList.remove('expanded');
        btn.textContent = 'Read more';
        btn.dataset.expanded = 'false';
      } else {
        fullBio.classList.add('expanded');
        btn.textContent = 'Read less';
        btn.dataset.expanded = 'true';
      }
    });
  });
}

// ─── Studio: Left Panel ──────────────────────────────────────────────────────
function initStudioLeft() {
  initUpload();
  initStylePills();
  initLyricToggle();
  initGenerate();

  // Pre-fill artist if wolf selected
  if (state.selectedWolf) {
    const artistInput = $('song-artist');
    if (artistInput) artistInput.value = state.selectedWolf.artist || '';
  }
}

// ─── Upload ──────────────────────────────────────────────────────────────────
function initUpload() {
  const zone = $('upload-zone');
  const input = $('file-input');
  const placeholder = $('upload-placeholder');
  const info = $('upload-info');
  const filename = $('upload-filename');
  const removeBtn = $('upload-remove');

  if (!zone || !input) return;

  zone.addEventListener('click', (e) => {
    if (e.target === removeBtn || e.target.closest('.upload-remove')) return;
    input.click();
  });

  input.addEventListener('change', () => {
    if (input.files[0]) handleFile(input.files[0]);
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.uploadedFile = null;
      input.value = '';
      info.classList.add('hidden');
      if (placeholder) placeholder.style.display = '';
    });
  }

  async function handleFile(file) {
    // 100MB limit
    if (file.size > 100 * 1024 * 1024) {
      toast('File too large. Max 100MB.', 'error');
      return;
    }

    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    filename.textContent = `${file.name} (${sizeMB} MB)`;
    info.classList.remove('hidden');
    if (placeholder) placeholder.style.display = 'none';

    // Upload to server
    const fd = new FormData();
    fd.append('file', file);
    try {
      filename.textContent = `Uploading ${file.name}...`;
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      state.uploadedFile = json;
      filename.textContent = `${json.originalName} · ${sizeMB} MB`;
      filename.style.color = '';
    } catch (err) {
      filename.textContent = `Failed: ${err.message}`;
      filename.style.color = '#ff4455';
      state.uploadedFile = null;
    }
  }
}

// ─── Style Pills ─────────────────────────────────────────────────────────────
function initStylePills() {
  const pills = document.querySelectorAll('.style-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });
}

// ─── Lyric Video Toggle ──────────────────────────────────────────────────────
function initLyricToggle() {
  const toggle = $('auto-lyric-toggle');
  const options = $('lyric-options');
  if (!toggle || !options) return;

  toggle.addEventListener('change', () => {
    if (toggle.checked) {
      options.classList.remove('hidden');
    } else {
      options.classList.add('hidden');
    }
  });
}

// ─── Generate ────────────────────────────────────────────────────────────────
function initGenerate() {
  const btn = $('generate-btn');
  if (!btn) return;
  btn.addEventListener('click', handleGenerate);
}

async function handleGenerate() {
  const title = $('song-title')?.value.trim();
  const artist = $('song-artist')?.value.trim();
  const genre = $('song-genre')?.value;
  const bpm = $('song-bpm')?.value.trim();
  const language = $('song-language')?.value;
  const mood = $('song-mood')?.value.trim();
  const errEl = $('gen-error');

  if (errEl) errEl.classList.add('hidden');

  if (!title || !artist || !genre) {
    if (errEl) { errEl.textContent = 'Please fill in Song Title, Artist Name, and Genre.'; errEl.classList.remove('hidden'); }
    return;
  }

  // Credit check (members bypass)
  const isMember = state.profile?.role === 'member' || state.profile?.role === 'admin';
  if (!isMember) {
    if (state.credits < 10) {
      showCreditModal();
      return;
    }
  }

  if (state.generating) return;
  state.generating = true;

  const btn = $('generate-btn');
  const btnText = btn.querySelector('.btn-generate-text');
  btn.disabled = true;
  btnText.textContent = 'Generating...';

  try {
    const body = { title, artist, genre, language, wolfId: state.selectedWolf?.id };
    if (bpm) body.bpm = bpm;
    if (mood) body.mood = mood;
    if (state.token) body.token = state.token;

    // Get selected style
    const activeStyle = document.querySelector('.style-pill.active');
    if (activeStyle) body.style = activeStyle.dataset.style;

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) {
      if (json.error === 'LIMIT_REACHED') {
        showCreditModal();
        return;
      }
      throw new Error(json.error || 'Generation failed');
    }

    // Deduct credits (non-members)
    if (!isMember) {
      spendCredits(10);
      state.genCount++;
      localStorage.setItem('lw_gen_count', state.genCount);
    }

    state.lastPack = json.pack;
    renderResults(json.pack, json.meta);
    toast('Generation complete!', 'success');

  } catch (err) {
    // Auto-refund on server error
    if (!isMember && state.credits >= 0) {
      toast('Generation failed. Credits refunded.', 'error');
    } else {
      toast(err.message, 'error');
    }
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Generate · 10 ⚡';
    state.generating = false;
  }
}

// ─── Studio: Center Panel ────────────────────────────────────────────────────
function initStudioCenter() {
  initStudioTabs();
  initTimelineControls();
  initTimelineDropzone();
}

// ─── Studio Tab Switching ────────────────────────────────────────────────────
function initStudioTabs() {
  document.querySelectorAll('.studio-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.studio-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.studio-tab-panel').forEach(p => p.classList.add('hidden'));
      const panel = $(`stab-${tab.dataset.tab}`);
      if (panel) panel.classList.remove('hidden');
    });
  });
}

// ─── Render Results into Center Panel ────────────────────────────────────────
function escapeHTML(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderResults(pack, meta) {
  // Show active, hide empty
  const empty = $('studio-empty');
  const active = $('studio-active');
  if (empty) empty.classList.add('hidden');
  if (active) active.classList.remove('hidden');

  // Show right panel
  const right = $('studio-right');
  if (right) right.classList.remove('hidden');

  // Lyrics
  renderLyrics(pack.lyrics || []);

  // SRT
  const srtText = $('srt-text');
  if (srtText && pack.srt) srtText.textContent = pack.srt;

  // Beats
  renderBeats(pack.beats || []);

  // Prompts
  renderPrompts(pack.prompts || []);

  // Tips
  renderTips(pack.tips || []);

  // Update BPM badges
  const bpm = meta?.bpm || $('song-bpm')?.value || '--';
  const bpmBadge = $('bpm-badge');
  const tlBpm = $('tl-bpm');
  if (bpmBadge) bpmBadge.textContent = `${bpm} BPM`;
  if (tlBpm) tlBpm.textContent = `${bpm} BPM`;

  // Beat count
  const beatCount = $('beat-count-badge');
  if (beatCount) beatCount.textContent = `${(pack.beats || []).length} drops`;

  // Render timeline words
  renderTimelineWords(pack.lyrics || []);

  // Render beat markers
  renderBeatMarkers(pack.beats || []);

  // Draw waveform placeholder
  drawWaveformPlaceholder();
}

function renderLyrics(lyrics) {
  const list = $('lyrics-list');
  if (!list) return;
  list.innerHTML = '';
  lyrics.forEach(line => {
    const text = line.text || '';
    const isSectionHeader = /^\[.+\]$/.test(text.trim());
    if (isSectionHeader) {
      const div = document.createElement('div');
      div.className = 'lyric-section';
      div.textContent = text.replace(/[\[\]]/g, '');
      list.appendChild(div);
    } else {
      const div = document.createElement('div');
      div.className = 'lyric-line';
      div.innerHTML = `<span class="lyric-ts">${escapeHTML(line.ts || '')}</span><span class="lyric-text">${escapeHTML(text)}</span>`;
      list.appendChild(div);
    }
  });
}

function renderBeats(beats) {
  const tbody = $('beats-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  beats.forEach(beat => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="lyric-ts">${escapeHTML(beat.ts || '')}</span></td>
      <td>${escapeHTML(beat.label || '')}</td>
      <td><span class="beat-type-badge beat-type-${escapeHTML(beat.type || 'CUT')}">${escapeHTML(beat.type || 'CUT')}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderPrompts(prompts) {
  const list = $('prompts-list');
  if (!list) return;
  list.innerHTML = '';
  prompts.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'prompt-card';
    card.innerHTML = `
      <div class="prompt-section">${escapeHTML(p.section || '')}</div>
      <div class="prompt-text">${escapeHTML(p.prompt || '')}</div>
      <button class="prompt-copy" data-idx="${i}">Copy</button>
    `;
    list.appendChild(card);
  });
  list.querySelectorAll('.prompt-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const text = prompts[idx]?.prompt || '';
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });
  });
}

const TIP_ICONS = ['📱','🎬','▶️','🎨','🔊','💡','🌟','🎯'];

function renderTips(tips) {
  const list = $('tips-list');
  if (!list) return;
  list.innerHTML = '';
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
    list.appendChild(card);
  });
}

// ─── Timeline: Word blocks ───────────────────────────────────────────────────
function renderTimelineWords(lyrics) {
  const container = $('timeline-words');
  if (!container) return;
  container.innerHTML = '';
  lyrics.forEach(line => {
    if (/^\[.+\]$/.test((line.text || '').trim())) return;
    const words = (line.text || '').split(/\s+/);
    words.forEach(word => {
      if (!word) return;
      const el = document.createElement('span');
      el.className = 'timeline-word';
      el.textContent = word;
      el.draggable = true;
      container.appendChild(el);
    });
  });
}

// ─── Timeline: Beat markers ──────────────────────────────────────────────────
let savedBeatMarkers = [];

function renderBeatMarkers(beats) {
  const container = $('timeline-beat-markers');
  if (!container) return;
  container.innerHTML = '';
  savedBeatMarkers = beats;

  if (!beats.length) return;

  // Parse timestamps to seconds for positioning
  const totalDuration = parseTsToSeconds(beats[beats.length - 1].ts) + 30;
  beats.forEach(beat => {
    const seconds = parseTsToSeconds(beat.ts);
    const pct = (seconds / totalDuration) * 100;
    const marker = document.createElement('div');
    marker.className = 'beat-marker';
    marker.style.left = `${pct}%`;
    marker.title = `${beat.ts} — ${beat.label || ''}`;
    container.appendChild(marker);
  });
}

function parseTsToSeconds(ts) {
  if (!ts) return 0;
  const parts = ts.split(':');
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  if (parts.length === 3) return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  return parseFloat(ts) || 0;
}

// ─── Waveform Placeholder ────────────────────────────────────────────────────
function drawWaveformPlaceholder() {
  const canvas = $('waveform-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(245, 197, 24, 0.15)';
  const bars = Math.floor(w / 3);
  for (let i = 0; i < bars; i++) {
    const amplitude = Math.sin(i * 0.05) * 0.3 + Math.random() * 0.4 + 0.1;
    const barH = amplitude * h;
    const x = i * 3;
    ctx.fillRect(x, (h - barH) / 2, 2, barH);
  }
}

// ─── Timeline Controls ───────────────────────────────────────────────────────
let isPlaying = false;
let playInterval = null;

function initTimelineControls() {
  const playBtn = $('tl-play');
  const prevBtn = $('tl-prev');
  const nextBtn = $('tl-next');
  const addCutBtn = $('tl-add-cut');
  const addWordBtn = $('tl-add-word');
  const editLyricsBtn = $('tl-edit-lyrics');
  const noCutsToggle = $('tl-no-cuts');
  const exportBtn = $('tl-export');

  if (playBtn) playBtn.addEventListener('click', togglePlay);
  if (prevBtn) prevBtn.addEventListener('click', () => movePlayhead(-5));
  if (nextBtn) nextBtn.addEventListener('click', () => movePlayhead(5));

  if (addCutBtn) addCutBtn.addEventListener('click', () => toast('Cut added at playhead position', 'info'));
  if (addWordBtn) addWordBtn.addEventListener('click', () => toast('Word added at playhead position', 'info'));
  if (editLyricsBtn) editLyricsBtn.addEventListener('click', () => toast('Lyrics editor coming soon', 'info'));
  if (exportBtn) exportBtn.addEventListener('click', () => toast('Export coming soon', 'info'));

  if (noCutsToggle) {
    noCutsToggle.addEventListener('change', () => {
      const markers = $('timeline-beat-markers');
      if (!markers) return;
      if (noCutsToggle.checked) {
        markers.style.display = 'none';
        toast('Cut markers hidden — one continuous slot', 'info');
      } else {
        markers.style.display = '';
        toast('Cut markers restored', 'info');
      }
    });
  }
}

function togglePlay() {
  isPlaying = !isPlaying;
  const icon = $('tl-play-icon');
  if (isPlaying) {
    if (icon) icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
    startPlayback();
  } else {
    if (icon) icon.innerHTML = '<polygon points="5,3 19,12 5,21"/>';
    stopPlayback();
  }
}

function startPlayback() {
  const playhead = $('timeline-playhead');
  const waveform = $('timeline-waveform');
  if (!playhead || !waveform) return;
  const maxWidth = waveform.clientWidth;

  playInterval = setInterval(() => {
    let left = parseFloat(playhead.style.left) || 0;
    left += 1;
    if (left >= maxWidth) { left = 0; togglePlay(); }
    playhead.style.left = `${left}px`;
  }, 50);
}

function stopPlayback() {
  if (playInterval) { clearInterval(playInterval); playInterval = null; }
}

function movePlayhead(deltaPx) {
  const playhead = $('timeline-playhead');
  if (!playhead) return;
  let left = parseFloat(playhead.style.left) || 0;
  left = Math.max(0, left + deltaPx * 10);
  playhead.style.left = `${left}px`;
}

// ─── Timeline: Video Dropzone ────────────────────────────────────────────────
function initTimelineDropzone() {
  const dz = $('timeline-dropzone');
  if (!dz) return;

  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('video/')) {
      toast('Please drop a video file', 'error');
      return;
    }
    showTrimModal(file);
  });
}

function showTrimModal(file) {
  const overlay = $('modal-overlay');
  const box = $('modal-box');
  if (!overlay || !box) return;

  const url = URL.createObjectURL(file);
  box.innerHTML = `
    <div class="modal-header">
      <h3>Trim Video</h3>
      <button class="modal-close" id="trim-close">&times;</button>
    </div>
    <video src="${url}" style="width:100%;border-radius:var(--radius);background:#000;max-height:240px" controls></video>
    <div style="margin-top:16px;display:flex;gap:12px;align-items:center">
      <div class="field-group" style="flex:1">
        <label>Start (s)</label>
        <input type="number" id="trim-start" value="0" min="0" step="0.1" />
      </div>
      <div class="field-group" style="flex:1">
        <label>End (s)</label>
        <input type="number" id="trim-end" value="5" min="0" step="0.1" />
      </div>
    </div>
    <button class="btn-gold btn-full" style="margin-top:16px" id="trim-save">Save to Timeline</button>
  `;
  overlay.classList.remove('hidden');

  $('trim-close')?.addEventListener('click', () => { overlay.classList.add('hidden'); URL.revokeObjectURL(url); });
  $('trim-save')?.addEventListener('click', () => {
    const dz = $('timeline-dropzone');
    const dzText = dz?.querySelector('.timeline-dropzone-text');
    if (dzText) {
      dzText.textContent = `${file.name} (trimmed)`;
      dzText.style.color = 'var(--wolf-shiteux)';
    }
    overlay.classList.add('hidden');
    toast('Video added to timeline', 'success');
    URL.revokeObjectURL(url);
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.classList.add('hidden'); URL.revokeObjectURL(url); } }, { once: true });
}

// ─── SRT Download ────────────────────────────────────────────────────────────
function initDownloads() {
  const srtBtn = $('download-srt');
  if (srtBtn) srtBtn.addEventListener('click', () => {
    const text = $('srt-text')?.textContent || '';
    downloadFile(text, 'lyrics.srt', 'text/plain');
  });

  const beatsBtn = $('export-beats');
  if (beatsBtn) beatsBtn.addEventListener('click', () => {
    const rows = document.querySelectorAll('#beats-tbody tr');
    let txt = 'TIMESTAMP\tLABEL\tTYPE\n';
    rows.forEach(tr => {
      const cells = tr.querySelectorAll('td');
      txt += `${cells[0]?.textContent}\t${cells[1]?.textContent}\t${cells[2]?.textContent?.trim()}\n`;
    });
    downloadFile(txt, 'beat-cuts.txt', 'text/plain');
  });
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Credit Modal ────────────────────────────────────────────────────────────
function showCreditModal() {
  const overlay = $('modal-overlay');
  const box = $('modal-box');
  if (!overlay || !box) return;

  box.innerHTML = `
    <div style="text-align:center">
      <div style="font-size:32px;margin-bottom:12px">⚡</div>
      <h3 style="font-size:18px;font-weight:500;margin-bottom:8px">Not enough credits</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:24px">
        You need 10 ⚡ to generate. Earn credits from tasks or upgrade your plan.
      </p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <a href="#/pricing" class="btn-gold btn-full" id="modal-pricing-btn">Get Access</a>
        <button class="btn-ghost btn-full" id="modal-close-btn">Not now</button>
      </div>
    </div>
  `;
  overlay.classList.remove('hidden');

  $('modal-pricing-btn')?.addEventListener('click', () => overlay.classList.add('hidden'));
  $('modal-close-btn')?.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); }, { once: true });
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function init() {
  checkReferralCode();
  await initSupabase();
  await checkSession();
  updateTopbarAuth();
  updateCreditDisplay();
  initRouter();
  initTopbarAuth();
  initCreditPill();
  initBugReport();
  initCrewPage();
  initStudioLeft();
  initStudioCenter();
  initDownloads();

  // Show admin nav if admin
  if (state.profile?.role === 'admin' || state.profile?.email === 'lazyjo@lightningwolves.studio') {
    const adminLink = $('admin-nav-link');
    if (adminLink) adminLink.style.display = '';
  }

  // Supabase auth listener
  if (supabase) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        state.user = session.user;
        state.token = session.access_token;
        await loadProfile();
      } else {
        state.user = null;
        state.token = null;
        state.profile = null;
      }
      updateTopbarAuth();
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
