/* ═══════════════════════════════════════════════════════════════════════════
   LIGHTNING WOLVES STUDIO — App Core
   Step 1: Global Layout (sidebar, topbar, routing, credits, toast)
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
console.log('[LW] app.js loaded');

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
  landing: 'Which Wolf Are You?',
  home: 'Home',
  studio: 'Studio',
  pricing: 'Pricing',
  join: 'Join the Pack',
  auth: 'Sign In',
  admin: 'Admin',
  'wolf-profile': 'Crew',
};

// navigateTo — delegates to the inline router + handles wolf profiles
function navigateTo(page, params) {
  if (page === 'wolf-profile' && params && params.wolfId) {
    window.location.hash = '/crew/' + params.wolfId;
    return;
  }
  window.location.hash = '/' + (page === 'landing' ? '' : page);
}

// Expose state for inline router
window._lwState = state;

function initRouter() {
  // The inline router in index.html handles page switching.
  // This hooks into hashchange for wolf profile rendering.
  function onRoute() {
    var hash = (window.location.hash || '').replace(/^#\/?/, '') || 'landing';
    var parts = hash.split('/');

    if (parts[0] === 'crew' && parts[1]) {
      renderWolfProfile(parts[1]);
      state.currentPage = 'wolf-profile';
    } else {
      state.currentPage = parts[0] || 'landing';
    }
  }

  window.addEventListener('hashchange', onRoute);
  window.addEventListener('load', onRoute);
  onRoute();
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
    // Save to localStorage for admin
    const bugs = JSON.parse(localStorage.getItem('lw_bug_reports') || '[]');
    bugs.push({ description: desc, status: 'pending', reportedAt: new Date().toISOString() });
    localStorage.setItem('lw_bug_reports', JSON.stringify(bugs));
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

// ─── Merge localStorage into Account on Signup ──────────────────────────────
function mergeLocalStorageToAccount() {
  if (!state.user) return;
  // This runs after successful signup/signin to persist guest data
  // Credits, tasks, referrals all transfer to the account
  const mergeData = {
    credits: state.credits,
    completedTasks: state.completedTasks,
    genCount: state.genCount,
    referralCount: state.referralCount,
    promoCode: state.promoCode,
    refCode: state.refCode,
  };

  // Auto-complete signup task if not already done
  if (!state.completedTasks.includes('signup')) {
    state.completedTasks.push('signup');
    localStorage.setItem('lw_completed_tasks', JSON.stringify(state.completedTasks));
    addCredits(10);
    toast('Welcome! +10 ⚡ signup bonus', 'success');
  }

  // If user signed up via referral, award referred user bonus
  if (state.refCode) {
    // The referral credit for the new user is already handled by the signup task
    // The referrer gets credited server-side
    toast('Referral bonus applied!', 'success');
  }

  // In production: sync to Supabase profile
  if (supabase && state.user) {
    supabase.from('profiles').update({
      credits: state.credits,
      completed_tasks: state.completedTasks,
      generations_count: state.genCount,
    }).eq('id', state.user.id).then(() => {}).catch(() => {});
  }
}

// ─── Google OAuth (YouTube Verification) ─────────────────────────────────────
function initGoogleOAuth() {
  // Check for OAuth callback
  const hash = window.location.hash;
  const params = new URLSearchParams(window.location.search);

  if (params.get('code') || hash.includes('access_token')) {
    handleOAuthCallback();
  }
}

function startYouTubeOAuth() {
  const clientId = window.VITE_GOOGLE_CLIENT_ID || '';
  if (!clientId) {
    toast('Google OAuth not configured. Task marked as pending.', 'info');
    return;
  }

  const redirectUri = window.location.origin + '/callback';
  const scope = 'https://www.googleapis.com/auth/youtube.readonly';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}`;

  window.location.href = authUrl;
}

async function handleOAuthCallback() {
  // Extract access token from hash fragment
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hashParams.get('access_token');

  if (!accessToken) return;

  // Clean URL
  window.history.replaceState(null, '', window.location.pathname);

  try {
    // Check YouTube subscriptions
    const res = await fetch('https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) throw new Error('Failed to fetch subscriptions');

    const data = await res.json();
    const items = data.items || [];

    // Check if Lightning Wolves channel is in subscriptions
    const isSubscribed = items.some(item => {
      const title = (item.snippet?.title || '').toLowerCase();
      return title.includes('lightning wolves') || title.includes('lightningwolves');
    });

    if (isSubscribed) {
      completeTask('youtube');
    } else {
      toast('Lightning Wolves channel not found in your subscriptions. Subscribe and try again.', 'error');
    }
  } catch (err) {
    toast('YouTube verification failed: ' + err.message, 'error');
  }
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
  lazyjo: {
    id: 'lazyjo', name: 'Lazy Jo', color: '#f5c518', genre: 'Melodic Hip-Hop', artist: 'Lazy Jo', role: 'Founder · Artist',
    wolfImg: '/LightningWolfYellowTransparentBG.png', animation: '/Lazy Jo Wolf Card Animation.mp4',
    bio: 'Every pack needs a leader. Joeri Van Tricht — Lazy Jo — founded Lightning Wolves with a vision: build a crew where every artist wins together. Born in Belgium, his melodic hip-hop blends introspective lyricism with infectious energy. The architect of the sound, the face of the pack.'
  },
  zirka: {
    id: 'zirka', name: 'Zirka', color: '#b388ff', genre: 'French Hip-Hop', artist: 'Zirka', role: 'Artist',
    wolfImg: '/LightningWolfPurpleTransparentBG.png',
    bio: 'French hip-hop energy with melodic punch.'
  },
  rosakay: {
    id: 'rosakay', name: 'Rosakay', color: '#ff80ab', genre: 'Pop / French Pop', artist: 'Rosakay', role: 'Artist',
    wolfImg: '/LightningWolfOrangeTransparentBG.png', image: '/Rosakay Profile.jpeg', animation: '/Rosakay Wolf Animation.mp4',
    instagram: 'https://www.instagram.com/rosakay_officiel', spotify: 'https://open.spotify.com/artist/5DaB9HZOXF1kOqxLiS2d4B',
    bio: 'Sarah Kingambo. Pop with a French soul.'
  },
  drippy: {
    id: 'drippy', name: 'Drippydesigns', color: '#82b1ff', genre: 'Visual Art', artist: 'Drippydesigns', role: 'Designer',
    wolfImg: '/LightningWolfGreenTransparentBG.png',
    bio: 'The visual identity behind the pack.'
  },
  shiteux: {
    id: 'shiteux', name: 'Shiteux', color: '#69f0ae', genre: 'Photo · Video · Beats', artist: 'Shiteux', role: 'Visuals',
    wolfImg: '/LightningWolfRoseTransparentBG.png',
    bio: 'Every pack needs someone watching. Pierre Van der Heyde — Shiteux — is the one behind the camera and behind the beat. Born in Belgium in 1997, he documents the Lightning Wolves world through photos, video, and sound. From lo-fi meditations \'Sin[e]\' and \'Doubt Clouds\' to his evolving chillout project Behind this Luck, Shiteux moves quietly and creates loudly.'
  },
};

// ─── Crew Page ───────────────────────────────────────────────────────────────
var crewParticlesStarted = false;

function initCrewPage() {
  // Particles may not be ready yet (DOM mover hasn't run), so also hook hashchange
  tryInitCrewParticles();
  window.addEventListener('hashchange', function() {
    var hash = (window.location.hash || '').replace(/^#\/?/, '') || 'landing';
    if (hash === '' || hash === 'landing' || hash === 'crew') {
      tryInitCrewParticles();
    }
  });
}

function tryInitCrewParticles() {
  if (crewParticlesStarted) return;
  var canvas = document.getElementById('crew-particles');
  if (!canvas) return;
  crewParticlesStarted = true;

  var ctx = canvas.getContext('2d');
  var particles = [];

  function resize() {
    canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth;
    canvas.height = canvas.parentElement ? canvas.parentElement.clientHeight : window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (var i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2.5 + 0.5,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.5 + 0.15,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 197, 24, ' + p.alpha + ')';
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
}

// ─── Wolf Profile Page ───────────────────────────────────────────────────────
function renderWolfProfile(wolfId) {
  var wolf = WOLVES[wolfId];
  var container = document.getElementById('wolf-profile-content');
  if (!wolf || !container) return;

  // Wolf image for flip card front
  var wolfImgSrc = wolf.wolfImg || '/LightningWolvesLogoTransparentBG.png';

  // Animation video (Lazy Jo and Rosakay have these)
  var animationHtml = '';
  if (wolf.animation) {
    animationHtml = '<div class="wp-animation"><video src="' + wolf.animation + '" autoplay loop muted playsinline class="wp-animation-video"></video></div>';
  }

  // Social links
  var socialsHtml = '';
  if (wolf.instagram || wolf.spotify) {
    socialsHtml = '<div class="wp-socials">';
    if (wolf.instagram) {
      socialsHtml += '<a href="' + wolf.instagram + '" target="_blank" rel="noopener" class="wp-social-link">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>'
        + ' Instagram</a>';
    }
    if (wolf.spotify) {
      socialsHtml += '<a href="' + wolf.spotify + '" target="_blank" rel="noopener" class="wp-social-link">'
        + '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.5 17.3c-.2.3-.6.4-1 .2-2.7-1.6-6-2-10-1.1-.4.1-.7-.2-.8-.5-.1-.4.2-.7.5-.8 4.3-1 8.1-.6 11.1 1.2.3.2.4.7.2 1zm1.5-3.3c-.3.4-.8.5-1.2.3-3-1.9-7.7-2.4-11.3-1.3-.4.1-.9-.1-1-.6-.1-.4.1-.9.6-1 4.1-1.3 9.2-.7 12.6 1.5.3.2.5.7.3 1.1z"/></svg>'
        + ' Spotify</a>';
    }
    socialsHtml += '</div>';
  }

  // Buttons
  var buttonsHtml = '';
  if (wolfId === 'lazyjo') {
    buttonsHtml += '<a href="https://www.gigstarter.be/artists/lazy-jo" target="_blank" rel="noopener" class="btn-gold">Book Lazy Jo</a>';
  }
  buttonsHtml += '<a href="#/studio" class="btn-outline wp-enter-studio" data-wolf="' + wolfId + '">Enter Studio as ' + escapeHTML(wolf.name) + '</a>';

  container.innerHTML = ''
    + '<a href="#/crew" class="wp-back">\u2190 Back to Crew</a>'
    + '<div class="wp-layout" style="--wp-color:' + wolf.color + '">'

    // Flip Card
    + '  <div class="wp-flip-card">'
    + '    <div class="wp-flip-inner" id="wp-flip-inner">'
    + '      <div class="wp-flip-front">'
    + '        <div class="wp-card-front-img">'
    + '          <img src="' + wolfImgSrc + '" alt="' + escapeHTML(wolf.name) + '" />'
    + '          <div class="wp-card-front-glow"></div>'
    + '        </div>'
    + '        <div class="wp-card-front-info">'
    + '          <h2 class="wp-card-front-name">' + escapeHTML(wolf.name) + '</h2>'
    + '          <span class="wp-card-front-genre">' + escapeHTML(wolf.genre) + '</span>'
    + '        </div>'
    + '      </div>'
    + '      <div class="wp-flip-back">'
    + '        <div class="wp-flip-back-content">'
    + '          <h2 class="wp-flip-back-name">' + escapeHTML(wolf.name) + '</h2>'
    + '          <p class="wp-flip-back-bio">' + escapeHTML(wolf.bio) + '</p>'
    + '        </div>'
    + '      </div>'
    + '    </div>'
    + '    <div class="wp-flip-hint">Click to flip</div>'
    + '  </div>'

    // Info Panel
    + '  <div class="wp-info">'
    + '    <span class="wp-role" style="color:' + wolf.color + '">' + escapeHTML(wolf.role) + '</span>'
    + '    <h1 class="wp-title" style="color:' + wolf.color + '">' + escapeHTML(wolf.name) + '</h1>'
    + '    <span class="wp-subtitle">' + escapeHTML(wolf.genre) + '</span>'
    + '    <p class="wp-bio">' + escapeHTML(wolf.bio) + '</p>'
    +      animationHtml
    +      socialsHtml
    + '    <div class="wp-buttons">' + buttonsHtml + '</div>'
    + '  </div>'
    + '</div>';

  // Flip card click
  var flipInner = document.getElementById('wp-flip-inner');
  if (flipInner) {
    flipInner.addEventListener('click', function() {
      flipInner.classList.toggle('flipped');
    });
  }

  // Enter studio button
  var studioBtns = container.querySelectorAll('.wp-enter-studio');
  for (var i = 0; i < studioBtns.length; i++) {
    studioBtns[i].addEventListener('click', function(e) {
      e.preventDefault();
      state.selectedWolf = wolf;
      window.location.hash = '/studio';
    });
  }
}

// ─── Beat Detection (Web Audio API) ──────────────────────────────────────────
async function detectBeats(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();

    // Use OfflineAudioContext for analysis
    const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;

    // Low-pass filter to isolate bass/kick frequencies
    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 150;

    source.connect(filter);
    filter.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const data = renderedBuffer.getChannelData(0);

    // Analyze energy peaks
    const sampleRate = renderedBuffer.sampleRate;
    const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
    const beats = [];
    let prevEnergy = 0;
    const threshold = 1.4; // Energy must be 1.4x previous window

    for (let i = 0; i < data.length - windowSize; i += windowSize) {
      let energy = 0;
      for (let j = i; j < i + windowSize; j++) {
        energy += data[j] * data[j];
      }
      energy /= windowSize;

      if (prevEnergy > 0 && energy / prevEnergy > threshold && energy > 0.001) {
        const timestamp = i / sampleRate;
        // Avoid beats too close together (< 200ms)
        if (beats.length === 0 || timestamp - beats[beats.length - 1].time > 0.2) {
          beats.push({
            time: timestamp,
            ts: formatTimestamp(timestamp),
            energy: energy
          });
        }
      }
      prevEnergy = energy || 0.0001;
    }

    // Estimate BPM from beat intervals
    let bpm = 0;
    if (beats.length > 2) {
      const intervals = [];
      for (let i = 1; i < Math.min(beats.length, 50); i++) {
        intervals.push(beats[i].time - beats[i - 1].time);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      bpm = Math.round(60 / avgInterval);
      // Clamp to reasonable range
      if (bpm > 200) bpm = Math.round(bpm / 2);
      if (bpm < 60) bpm = Math.round(bpm * 2);
    }

    return { beats, bpm, duration: audioBuffer.duration };
  } catch (err) {
    console.error('Beat detection failed:', err);
    return { beats: [], bpm: 0, duration: 0 };
  }
}

function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

// ─── Beat Effect Trigger ─────────────────────────────────────────────────────
function triggerBeatEffect(timestamp) {
  const activeFx = document.querySelector('.fx-pill.active');
  const effect = activeFx?.dataset.fx || 'flash';
  const previewFrames = document.querySelectorAll('.preview-frame');

  previewFrames.forEach(frame => {
    frame.classList.remove('beat-effect-flash', 'beat-effect-zoom', 'beat-effect-shake', 'beat-effect-colorburst');
    // Force reflow
    void frame.offsetWidth;
    frame.classList.add(`beat-effect-${effect}`);
    setTimeout(() => frame.classList.remove(`beat-effect-${effect}`), 400);
  });
}

// ─── Transcription with Retry ────────────────────────────────────────────────
async function transcribeAudio(file, maxRetries = 3) {
  const fd = new FormData();
  fd.append('file', file);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd });

      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        let errorMsg;
        if (contentType.includes('application/json')) {
          const json = await res.json();
          errorMsg = json.error || 'Transcription failed';
        } else {
          const text = await res.text();
          errorMsg = text || 'Transcription failed';
        }

        if (attempt < maxRetries) {
          toast(`Transcription attempt ${attempt} failed. Retrying...`, 'error');
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw new Error(errorMsg);
      }

      const json = await res.json();
      return json;
    } catch (err) {
      if (attempt >= maxRetries) {
        // Auto-refund credits
        const isMember = state.profile?.role === 'member' || state.profile?.role === 'admin';
        if (!isMember) {
          addCredits(10);
          toast('Transcription failed after 3 attempts. 10 ⚡ refunded.', 'error');
        } else {
          toast('Transcription failed after 3 attempts. ' + err.message, 'error');
        }
        return null;
      }
    }
  }
  return null;
}

// ─── Audio/Video Sync Verification ───────────────────────────────────────────
function verifySyncAlignment(audioTimestamps, videoTimestamps) {
  if (!audioTimestamps?.length || !videoTimestamps?.length) return { synced: true, drift: 0 };

  // Compare first and last timestamps for drift
  const audioDuration = audioTimestamps[audioTimestamps.length - 1];
  const videoDuration = videoTimestamps[videoTimestamps.length - 1];
  const drift = Math.abs(audioDuration - videoDuration);

  // More than 100ms drift is noticeable
  if (drift > 0.1) {
    return { synced: false, drift, correction: videoDuration / audioDuration };
  }

  return { synced: true, drift: 0 };
}

function realignTimestamps(timestamps, correctionFactor) {
  return timestamps.map(ts => ({
    ...ts,
    time: ts.time * correctionFactor,
    ts: formatTimestamp(ts.time * correctionFactor)
  }));
}

// ─── Model Health Config ─────────────────────────────────────────────────────
const modelConfig = {
  models: {
    grok: { name: 'Grok Imagine', status: 'green', enabled: true, cost: 10, description: 'High reliability, sharp images (~10s)' },
    seedance: { name: 'Seedance 2.0', status: 'yellow', enabled: false, cost: 15, description: 'Coming soon' },
    kling: { name: 'Kling', status: 'green', enabled: true, cost: 15, description: 'Performance/motion videos' },
  },
  primaryModel: 'grok',
  fallbackModel: 'kling',
};

function getModelConfig() {
  const saved = localStorage.getItem('lw_model_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      Object.assign(modelConfig, parsed);
    } catch { /* use defaults */ }
  }
  return modelConfig;
}

function saveModelConfig() {
  localStorage.setItem('lw_model_config', JSON.stringify(modelConfig));
}

function getActiveModel() {
  const config = getModelConfig();
  const primary = config.models[config.primaryModel];
  if (primary && primary.enabled && primary.status !== 'red') {
    return { id: config.primaryModel, ...primary };
  }
  // Fallback
  const fallback = config.models[config.fallbackModel];
  if (fallback && fallback.enabled && fallback.status !== 'red') {
    toast(`${primary?.name || 'Primary model'} is down. Using ${fallback.name} instead.`, 'info');
    return { id: config.fallbackModel, ...fallback };
  }
  return null;
}

function updateModelHealthUI() {
  const config = getModelConfig();
  Object.entries(config.models).forEach(([id, model]) => {
    const dot = $(`model-status-${id}`);
    if (dot) {
      dot.className = `model-status-dot model-status-${model.status}`;
    }
    const costEl = $(`model-cost-${id}`);
    if (costEl) costEl.textContent = `${model.cost} ⚡`;

    const row = document.querySelector(`.ai-model-row[data-model="${id}"]`);
    if (row) {
      row.classList.toggle('disabled', !model.enabled);
      row.classList.toggle('active', id === config.primaryModel);
    }
  });
}

function initModelSelection() {
  document.querySelectorAll('.ai-model-row').forEach(row => {
    row.addEventListener('click', () => {
      const modelId = row.dataset.model;
      const config = getModelConfig();
      const model = config.models[modelId];
      if (!model || !model.enabled) return;
      config.primaryModel = modelId;
      saveModelConfig();
      updateModelHealthUI();
    });
  });
  updateModelHealthUI();
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

  // Show generation progress with time estimate
  const genProgress = $('gen-progress');
  const genFill = $('gen-progress-fill');
  const genText = $('gen-progress-text');
  const estimatedSeconds = 15;
  let elapsed = 0;

  if (genProgress) genProgress.classList.remove('hidden');
  if (genFill) genFill.style.width = '0%';
  if (genText) genText.textContent = `Estimated: ~${estimatedSeconds}s`;

  // Live countdown
  const countdownInterval = setInterval(() => {
    elapsed++;
    const remaining = Math.max(0, estimatedSeconds - elapsed);
    const pct = Math.min(90, (elapsed / estimatedSeconds) * 90);
    if (genFill) genFill.style.width = `${pct}%`;

    if (remaining > 3) {
      if (genText) genText.textContent = `~${remaining}s remaining`;
    } else if (remaining > 0) {
      if (genText) genText.textContent = 'Finishing up...';
      if (genFill) genFill.style.width = '92%';
    } else {
      if (genText) genText.textContent = 'Almost there...';
    }
  }, 1000);

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

    clearInterval(countdownInterval);

    const json = await res.json();
    if (!res.ok) {
      if (json.error === 'LIMIT_REACHED') {
        showCreditModal();
        return;
      }
      throw new Error(json.error || 'Generation failed');
    }

    if (genFill) genFill.style.width = '100%';
    if (genText) genText.textContent = 'Done!';

    // Deduct credits (non-members)
    if (!isMember) {
      spendCredits(10);
      state.genCount++;
      localStorage.setItem('lw_gen_count', state.genCount);
    }

    state.lastPack = json.pack;

    // Run beat detection on uploaded file if available
    const fileInput = $('file-input');
    const uploadedRawFile = fileInput?.files?.[0];
    if (uploadedRawFile) {
      btnText.textContent = 'Detecting beats...';
      const beatResult = await detectBeats(uploadedRawFile);
      if (beatResult.beats.length > 0) {
        // Merge detected beats into pack
        json.pack.detectedBeats = beatResult.beats.map(b => ({
          ts: b.ts, label: 'Beat drop', type: 'CUT'
        }));
        if (beatResult.bpm) {
          json.meta.bpm = beatResult.bpm;
          const bpmInput = $('song-bpm');
          if (bpmInput && !bpmInput.value) bpmInput.value = beatResult.bpm;
        }
      }

      // Verify audio/video sync if we have both timestamps
      if (json.pack.lyrics?.length && json.pack.detectedBeats?.length) {
        const audioTs = json.pack.detectedBeats.map(b => parseTsToSeconds(b.ts));
        const lyricTs = json.pack.lyrics.filter(l => l.ts).map(l => parseTsToSeconds(l.ts));
        const syncCheck = verifySyncAlignment(audioTs, lyricTs);
        if (!syncCheck.synced) {
          toast(`Sync drift detected (${(syncCheck.drift * 1000).toFixed(0)}ms). Auto-correcting...`, 'info');
          json.pack.detectedBeats = realignTimestamps(
            json.pack.detectedBeats.map(b => ({ ...b, time: parseTsToSeconds(b.ts) })),
            syncCheck.correction
          );
        }
      }
    }

    renderResults(json.pack, json.meta);
    toast('Generation complete!', 'success');

  } catch (err) {
    clearInterval(countdownInterval);
    // Auto-refund on server error
    if (!isMember) {
      addCredits(10);
      state.genCount = Math.max(0, state.genCount - 1);
      localStorage.setItem('lw_gen_count', state.genCount);
      toast('Generation failed. 10 ⚡ refunded.', 'error');
    } else {
      toast(err.message, 'error');
    }
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    if (genText) genText.textContent = 'Failed';
    if (genFill) genFill.style.width = '0%';
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Generate · 10 ⚡';
    state.generating = false;
    // Hide progress after a moment
    setTimeout(() => { if (genProgress) genProgress.classList.add('hidden'); }, 3000);
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
      // Split text into clickable words for per-word styling
      const words = text.split(/(\s+)/);
      const wordsHtml = words.map(w => {
        if (/^\s+$/.test(w)) return w;
        return `<span class="lyric-text-word" data-word="${escapeHTML(w)}">${escapeHTML(w)}</span>`;
      }).join('');
      div.innerHTML = `<span class="lyric-ts">${escapeHTML(line.ts || '')}</span><span class="lyric-text">${wordsHtml}</span>`;
      list.appendChild(div);
    }
  });

  // Per-word click handler
  list.querySelectorAll('.lyric-text-word').forEach(wordEl => {
    wordEl.addEventListener('click', () => selectWordForStyling(wordEl));
  });

  // Apply current style to preview
  applyStyleToPreview();
}

// ─── Per-Word Styling ────────────────────────────────────────────────────────
let selectedWordEl = null;

function selectWordForStyling(wordEl) {
  // Deselect previous
  document.querySelectorAll('.lyric-text-word.word-selected').forEach(w => w.classList.remove('word-selected'));
  selectedWordEl = wordEl;
  wordEl.classList.add('word-selected');

  // Show per-word panel
  const panel = $('perword-selected');
  const label = $('perword-word-label');
  if (panel) panel.classList.remove('hidden');
  if (label) label.textContent = `"${wordEl.dataset.word}"`;
}

function initPerWordStyling() {
  const applyBtn = $('perword-apply');
  const clearBtn = $('perword-clear');

  if (applyBtn) applyBtn.addEventListener('click', () => {
    if (!selectedWordEl) return;
    const color = $('perword-color')?.value || '#ffffff';
    const weight = $('perword-weight')?.value || '400';
    selectedWordEl.style.color = color;
    selectedWordEl.style.fontWeight = weight;
    toast('Word style applied', 'success');
  });

  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (!selectedWordEl) return;
    selectedWordEl.style.color = '';
    selectedWordEl.style.fontWeight = '';
    selectedWordEl.classList.remove('word-selected');
    const panel = $('perword-selected');
    if (panel) panel.classList.add('hidden');
    selectedWordEl = null;
    toast('Word style cleared', 'info');
  });
}

// ─── Apply Lyric Style to Preview ────────────────────────────────────────────
function applyStyleToPreview() {
  const activePreset = document.querySelector('.preset-card.active');
  const style = activePreset?.dataset.preset || 'karaoke';
  const portraitOverlay = $('preview-lyric-portrait');
  const landscapeOverlay = $('preview-lyric-landscape');

  [portraitOverlay, landscapeOverlay].forEach(overlay => {
    if (!overlay) return;
    // Remove all style classes
    overlay.className = 'preview-lyric-overlay';
    overlay.classList.add(`lyric-style-${style}`);

    // Get current lyrics text for preview
    const firstLine = document.querySelector('.lyric-text');
    if (firstLine) {
      const words = firstLine.textContent.split(/\s+/).filter(Boolean);
      overlay.innerHTML = words.map(w => `<span class="lyric-word">${escapeHTML(w)} </span>`).join('');
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
  if (exportBtn) exportBtn.addEventListener('click', openExportModal);

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

// ─── Studio: Right Panel (Editor) ────────────────────────────────────────────
function initStudioRight() {
  initEditorTabs();
  initPresetGrid();
  initCustomizeControls();
  initBgPanel();
}

function initEditorTabs() {
  document.querySelectorAll('.editor-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.editor-panel').forEach(p => p.classList.add('hidden'));
      const panel = $(`etab-${tab.dataset.etab}`);
      if (panel) panel.classList.remove('hidden');
    });
  });
}

function initPresetGrid() {
  document.querySelectorAll('.preset-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      // Sync left panel style pills
      const preset = card.dataset.preset;
      const matchingPill = document.querySelector(`.style-pill[data-style="${preset}"]`);
      if (matchingPill) {
        document.querySelectorAll('.style-pill').forEach(p => p.classList.remove('active'));
        matchingPill.classList.add('active');
      }
      // Apply to preview
      applyStyleToPreview();
    });
  });
}

function initCustomizeControls() {
  // Font size slider
  const fontSlider = $('font-size-slider');
  const fontVal = $('font-size-val');
  if (fontSlider && fontVal) {
    fontSlider.addEventListener('input', () => { fontVal.textContent = `${fontSlider.value}px`; });
  }

  // Blur slider
  const blurSlider = $('bg-blur-slider');
  const blurVal = $('bg-blur-val');
  if (blurSlider && blurVal) {
    blurSlider.addEventListener('input', () => { blurVal.textContent = `${blurSlider.value}px`; });
  }

  // Position pills
  initPillGroup('.pos-pill');
  // Animation pills
  initPillGroup('.anim-pill');
  // FX pills
  initPillGroup('.fx-pill');

  // Color swatches
  initColorSwatches('text-color-presets', 'text-color-custom');
  initColorSwatches('highlight-color-presets', 'highlight-color-custom');
}

function initPillGroup(selector) {
  document.querySelectorAll(selector).forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll(selector).forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });
}

function initColorSwatches(containerId, customId) {
  const container = $(containerId);
  const custom = $(customId);
  if (!container) return;

  container.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
    });
  });

  if (custom) {
    custom.addEventListener('input', () => {
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    });
  }
}

function initBgPanel() {
  const zone = $('bg-upload-zone');
  const input = $('bg-file-input');
  if (zone && input) {
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      if (input.files[0]) {
        zone.innerHTML = `<span style="font-size:12px;color:var(--wolf-shiteux)">${input.files[0].name}</span>`;
      }
    });
  }

  const aiBtn = $('ai-bg-btn');
  if (aiBtn) {
    aiBtn.addEventListener('click', () => {
      const title = $('song-title')?.value.trim() || 'Untitled';
      const artist = $('song-artist')?.value.trim() || 'Unknown';
      const genre = $('song-genre')?.value || 'Hip-Hop';
      const mood = $('song-mood')?.value.trim() || '';
      const prompt = `Cinematic music video background for "${title}" by ${artist}. Genre: ${genre}.${mood ? ` Mood: ${mood}.` : ''} Dark, atmospheric, high contrast. 16:9 aspect ratio. No text or logos.`;
      navigator.clipboard.writeText(prompt).then(() => {
        toast('AI prompt copied to clipboard. Use with Grok Imagine or similar.', 'success');
      }).catch(() => {
        toast('AI background generation coming soon', 'info');
      });
    });
  }
}

// ─── Performance Video Tab ───────────────────────────────────────────────────
function initPerformanceTab() {
  const zone = $('perf-upload-zone');
  const input = $('perf-file-input');
  const preview = $('perf-preview');
  const placeholder = $('perf-upload-placeholder');
  const video = $('perf-video');
  const thumb = $('perf-thumb');
  const genBtn = $('perf-generate-btn');

  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;

    // Validate duration will happen after metadata loads
    const url = URL.createObjectURL(file);
    video.src = url;
    video.onloadedmetadata = () => {
      if (video.duration < 3 || video.duration > 30) {
        toast('Video must be 3-30 seconds', 'error');
        URL.revokeObjectURL(url);
        return;
      }
      preview.classList.remove('hidden');
      if (placeholder) placeholder.style.display = 'none';

      // Extract first frame
      video.currentTime = 0.1;
      video.onseeked = () => {
        const ctx = thumb.getContext('2d');
        ctx.drawImage(video, 0, 0, thumb.width, thumb.height);
        video.onseeked = null;
      };
    };
  });

  if (genBtn) genBtn.addEventListener('click', () => {
    toast('AI performance video generation coming soon', 'info');
    // Save template
    const templates = $('perf-templates');
    const list = $('perf-template-list');
    if (templates && list) {
      templates.classList.remove('hidden');
      const item = document.createElement('div');
      item.className = 'perf-template-item';
      item.innerHTML = `<canvas class="perf-template-thumb" width="48" height="27"></canvas><span>Template ${list.children.length + 1}</span>`;
      const ctx = item.querySelector('canvas').getContext('2d');
      if (video.readyState >= 2) ctx.drawImage(video, 0, 0, 48, 27);
      list.appendChild(item);
      toast('Template saved for infinite variations', 'success');
    }
  });
}

// ─── Remix Tab ───────────────────────────────────────────────────────────────
function initRemixTab() {
  const extractBtn = $('remix-extract-btn');
  const urlInput = $('remix-url');
  const segmentsDiv = $('remix-segments');
  const segmentList = $('remix-segment-list');
  const shuffleBtn = $('remix-shuffle');
  const noCutsToggle = $('remix-no-cuts');
  const exportBtn = $('remix-export-btn');

  if (!extractBtn) return;

  extractBtn.addEventListener('click', () => {
    const url = urlInput?.value.trim();
    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
      toast('Please enter a valid YouTube URL', 'error');
      return;
    }

    toast('Extracting clips from YouTube...', 'info');
    // Simulate AI scene detection
    setTimeout(() => {
      const categories = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Hook', 'Close-up', 'Wide shot', 'Transition'];
      const segments = [];
      const count = 6 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const start = i * 4;
        segments.push({
          label: `Scene ${i + 1}`,
          start: `${Math.floor(start / 60)}:${String(start % 60).padStart(2, '0')}`,
          end: `${Math.floor((start + 3 + Math.random() * 3) / 60)}:${String(Math.floor((start + 3 + Math.random() * 3) % 60)).padStart(2, '0')}`,
          category: categories[Math.floor(Math.random() * categories.length)]
        });
      }

      renderRemixSegments(segments);
      if (segmentsDiv) segmentsDiv.classList.remove('hidden');
      toast(`${segments.length} segments detected`, 'success');
    }, 1500);
  });

  if (shuffleBtn) shuffleBtn.addEventListener('click', () => {
    const items = Array.from(segmentList.children);
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      segmentList.appendChild(items[j]);
    }
    toast('Segments shuffled', 'info');
  });

  if (noCutsToggle) noCutsToggle.addEventListener('change', () => {
    if (noCutsToggle.checked) {
      segmentList.querySelectorAll('.remix-segment').forEach((s, i) => {
        s.style.display = i === 0 ? '' : 'none';
      });
      toast('No Cuts: one continuous slot', 'info');
    } else {
      segmentList.querySelectorAll('.remix-segment').forEach(s => s.style.display = '');
      toast('All segments restored', 'info');
    }
  });

  // Remix style pills
  document.querySelectorAll('.remix-style').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.remix-style').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
    });
  });

  if (exportBtn) exportBtn.addEventListener('click', () => toast('Remix export coming soon', 'info'));
}

function renderRemixSegments(segments) {
  const list = $('remix-segment-list');
  if (!list) return;
  list.innerHTML = '';
  segments.forEach((seg, i) => {
    const el = document.createElement('div');
    el.className = 'remix-segment';
    el.draggable = true;
    el.innerHTML = `
      <div class="remix-seg-thumb"></div>
      <div class="remix-seg-info">
        <div class="remix-seg-label">${seg.label}</div>
        <div class="remix-seg-time">${seg.start} → ${seg.end}</div>
      </div>
      <span class="remix-seg-category">${seg.category}</span>
    `;
    list.appendChild(el);
  });
}

// ─── Text Hooks ──────────────────────────────────────────────────────────────
const HOOKS = [
  { text: "Wait for it...", cat: "engagement", emoji: "👀" },
  { text: "This hit different", cat: "engagement", emoji: "🔥" },
  { text: "Turn this up", cat: "engagement", emoji: "🔊" },
  { text: "You need to hear this", cat: "engagement", emoji: "🎧" },
  { text: "Put your headphones on", cat: "engagement", emoji: "🎧" },
  { text: "Don't scroll past this", cat: "engagement", emoji: "⬇️" },
  { text: "Save this for later", cat: "engagement", emoji: "🔖" },
  { text: "POV: you found your new favorite song", cat: "curiosity", emoji: "✨" },
  { text: "Nobody's talking about this artist", cat: "curiosity", emoji: "🤫" },
  { text: "This song doesn't exist yet", cat: "curiosity", emoji: "👻" },
  { text: "What if I told you...", cat: "curiosity", emoji: "🤔" },
  { text: "You weren't supposed to find this", cat: "curiosity", emoji: "🔐" },
  { text: "The song that changed everything", cat: "curiosity", emoji: "💫" },
  { text: "Before this blows up", cat: "curiosity", emoji: "📈" },
  { text: "Bet you can't listen without vibing", cat: "challenge", emoji: "😤" },
  { text: "Try not to replay this", cat: "challenge", emoji: "🔁" },
  { text: "I dare you to skip this", cat: "challenge", emoji: "⏭️" },
  { text: "If this doesn't give you chills...", cat: "challenge", emoji: "🥶" },
  { text: "Only real ones will get this", cat: "challenge", emoji: "💯" },
  { text: "Rate this 1-10", cat: "challenge", emoji: "⭐" },
  { text: "Prove me wrong", cat: "challenge", emoji: "🤷" },
  { text: "This one's for the late nights", cat: "emotion", emoji: "🌙" },
  { text: "When the music hits your soul", cat: "emotion", emoji: "💜" },
  { text: "Close your eyes and feel this", cat: "emotion", emoji: "😌" },
  { text: "The song I wrote at 3am", cat: "emotion", emoji: "🕐" },
  { text: "Tears or chills?", cat: "emotion", emoji: "💧" },
  { text: "This is what heartbreak sounds like", cat: "emotion", emoji: "💔" },
  { text: "Healing energy only", cat: "emotion", emoji: "🌿" },
  { text: "Have you ever felt like this?", cat: "question", emoji: "🤍" },
  { text: "What genre is this?", cat: "question", emoji: "🎵" },
  { text: "Should I drop the full version?", cat: "question", emoji: "📀" },
  { text: "Who needs to hear this?", cat: "question", emoji: "👇" },
  { text: "What would you title this?", cat: "question", emoji: "📝" },
  { text: "Is this giving main character?", cat: "question", emoji: "🎬" },
  { text: "Album or single?", cat: "question", emoji: "💿" },
  { text: "Yeah, I made this", cat: "flex", emoji: "😎" },
  { text: "Independent artists do it better", cat: "flex", emoji: "🐺" },
  { text: "No label. No rules.", cat: "flex", emoji: "⚡" },
  { text: "Built different", cat: "flex", emoji: "🏗️" },
  { text: "From the basement to your feed", cat: "flex", emoji: "📱" },
  { text: "This cost $0 to make", cat: "flex", emoji: "💸" },
  { text: "Wolves don't follow sheep", cat: "flex", emoji: "🐺" },
  { text: "Let me tell you about the time...", cat: "story", emoji: "📖" },
  { text: "This is the song I almost deleted", cat: "story", emoji: "🗑️" },
  { text: "The story behind this track", cat: "story", emoji: "🎤" },
  { text: "I recorded this in one take", cat: "story", emoji: "🎙️" },
  { text: "3 months ago I almost quit music", cat: "story", emoji: "💭" },
  { text: "This beat found me at 2am", cat: "story", emoji: "🌃" },
  { text: "Every word is real", cat: "story", emoji: "📜" },
  { text: "Chapter one", cat: "story", emoji: "📕" },
];

function initHooksPanel() {
  const hookList = $('hook-list');
  const categorySelect = $('hook-category');
  const emojiToggle = $('hook-emoji-toggle');
  const customInput = $('hook-custom-text');
  const addCustomBtn = $('hook-add-custom');

  if (!hookList) return;

  function renderHooks() {
    const cat = categorySelect?.value || 'all';
    const showEmoji = emojiToggle?.checked !== false;
    hookList.innerHTML = '';

    const filtered = cat === 'all' ? HOOKS : HOOKS.filter(h => h.cat === cat);
    filtered.forEach((hook, i) => {
      const el = document.createElement('div');
      el.className = 'hook-item';
      el.textContent = showEmoji ? `${hook.emoji} ${hook.text}` : hook.text;
      el.addEventListener('click', () => {
        hookList.querySelectorAll('.hook-item').forEach(h => h.classList.remove('active'));
        el.classList.add('active');
        applyHookToPreview(el.textContent);
      });
      hookList.appendChild(el);
    });
  }

  renderHooks();
  if (categorySelect) categorySelect.addEventListener('change', renderHooks);
  if (emojiToggle) emojiToggle.addEventListener('change', renderHooks);

  // Hook style pills
  document.querySelectorAll('.hook-style-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.hook-style-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      // Re-apply current hook with new style
      const activeHook = hookList.querySelector('.hook-item.active');
      if (activeHook) applyHookToPreview(activeHook.textContent);
    });
  });

  // Custom hook
  if (addCustomBtn) addCustomBtn.addEventListener('click', () => {
    const text = customInput?.value.trim();
    if (!text) return;
    applyHookToPreview(text);
    toast('Custom hook added to preview', 'success');
  });
}

function applyHookToPreview(text) {
  const activeStyle = document.querySelector('.hook-style-pill.active');
  const styleName = activeStyle?.dataset.hstyle || 'bold-white';

  // Add hook overlay to preview frames
  document.querySelectorAll('.preview-frame').forEach(frame => {
    let overlay = frame.querySelector('.hook-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'hook-overlay';
      // Make draggable
      overlay.style.cursor = 'move';
      let isDragging = false, startY = 0, startTop = 0;
      overlay.addEventListener('mousedown', (e) => {
        isDragging = true;
        startY = e.clientY;
        startTop = parseInt(overlay.style.top) || 12;
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dy = e.clientY - startY;
        overlay.style.top = `${Math.max(4, startTop + dy)}px`;
      });
      document.addEventListener('mouseup', () => { isDragging = false; });
      overlay.style.pointerEvents = 'auto';
      frame.appendChild(overlay);
    }
    overlay.textContent = text;
    overlay.className = `hook-overlay hook-style-${styleName}`;
  });
}

// ─── Join the Pack ───────────────────────────────────────────────────────────
function initJoinPage() {
  // Role chips (multi-select)
  document.querySelectorAll('.role-chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });

  // Add social link (max 3)
  const addBtn = $('add-social-link');
  const list = $('social-links-list');
  if (addBtn && list) {
    addBtn.addEventListener('click', () => {
      if (list.children.length >= 3) {
        toast('Maximum 3 social links', 'info');
        return;
      }
      const row = document.createElement('div');
      row.className = 'social-link-row';
      row.innerHTML = `
        <select class="social-platform">
          <option value="">Platform</option>
          <option value="Instagram">Instagram</option>
          <option value="TikTok">TikTok</option>
          <option value="YouTube">YouTube</option>
          <option value="Twitter/X">Twitter/X</option>
          <option value="SoundCloud">SoundCloud</option>
          <option value="Other">Other</option>
        </select>
        <input type="url" class="social-url" placeholder="https://..." />
      `;
      list.appendChild(row);
    });
  }

  // Form submission
  const form = $('join-form');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const realName = $('join-realname')?.value.trim();
    const artistName = $('join-artistname')?.value.trim();
    const genre = $('join-genre')?.value.trim();
    const skills = $('join-skills')?.value.trim();
    const why = $('join-why')?.value.trim();
    const musicLink = $('join-music')?.value.trim();

    if (!realName || !artistName || !genre || !skills || !why) {
      toast('Please fill in all required fields', 'error');
      return;
    }

    // Collect roles
    const roles = [];
    document.querySelectorAll('.role-chip.selected').forEach(c => roles.push(c.dataset.role));

    // Collect social links
    const socials = [];
    document.querySelectorAll('.social-link-row').forEach(row => {
      const platform = row.querySelector('.social-platform')?.value;
      const url = row.querySelector('.social-url')?.value.trim();
      if (platform && url) socials.push({ platform, url });
    });

    const application = {
      realName, artistName, genre, roles, skills, socials, musicLink, why,
      status: 'pending',
      appliedAt: new Date().toISOString(),
    };

    // Save to DB
    try {
      if (supabase) {
        await supabase.from('applications').insert(application);
      }
      // Also save locally as backup
      const saved = JSON.parse(localStorage.getItem('lw_applications') || '[]');
      saved.push(application);
      localStorage.setItem('lw_applications', JSON.stringify(saved));

      toast('Application sent! We review every one personally.', 'success');
      form.reset();
      document.querySelectorAll('.role-chip.selected').forEach(c => c.classList.remove('selected'));
    } catch (err) {
      toast('Submission failed: ' + err.message, 'error');
    }
  });
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────
function initAdminDashboard() {
  // Admin tab switching
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.add('hidden'));
      const panel = $(`atab-${tab.dataset.atab}`);
      if (panel) panel.classList.remove('hidden');
      // Hide detail view when switching tabs
      const detail = $('admin-detail');
      if (detail) detail.classList.add('hidden');
      const appPanel = $('atab-applications');
      if (tab.dataset.atab === 'applications' && appPanel) appPanel.classList.remove('hidden');
    });
  });

  // Filter bar
  document.querySelectorAll('.admin-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderApplications(btn.dataset.filter);
    });
  });

  // Back from detail
  const backBtn = $('admin-detail-back');
  if (backBtn) backBtn.addEventListener('click', () => {
    $('admin-detail')?.classList.add('hidden');
    $('atab-applications')?.classList.remove('hidden');
  });

  // Save costs
  const saveCostsBtn = $('admin-save-costs');
  if (saveCostsBtn) saveCostsBtn.addEventListener('click', () => {
    toast('Credit costs saved', 'success');
  });

  // Load data
  renderApplications('all');
  renderAdminModels();
  renderAdminBugs();
}

function getApplications() {
  return JSON.parse(localStorage.getItem('lw_applications') || '[]');
}

function saveApplications(apps) {
  localStorage.setItem('lw_applications', JSON.stringify(apps));
}

function renderApplications(filter) {
  const apps = getApplications();
  const tbody = $('admin-tbody');
  const empty = $('admin-empty');
  if (!tbody) return;

  // Stats
  const total = apps.length;
  const pending = apps.filter(a => a.status === 'pending').length;
  const approved = apps.filter(a => a.status === 'approved').length;
  const rejected = apps.filter(a => a.status === 'rejected').length;

  const statTotal = $('stat-total');
  const statPending = $('stat-pending');
  const statApproved = $('stat-approved');
  const statRejected = $('stat-rejected');
  if (statTotal) statTotal.textContent = total;
  if (statPending) statPending.textContent = pending;
  if (statApproved) statApproved.textContent = approved;
  if (statRejected) statRejected.textContent = rejected;

  // Filter
  let filtered = apps;
  if (filter === 'pending' || filter === 'approved' || filter === 'rejected') {
    filtered = apps.filter(a => a.status === filter);
  } else if (filter !== 'all') {
    filtered = apps.filter(a => (a.roles || []).includes(filter));
  }

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  filtered.forEach((app, idx) => {
    const tr = document.createElement('tr');
    const statusClass = `admin-status-${app.status || 'pending'}`;
    const date = app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : '—';
    tr.innerHTML = `
      <td>${escapeHTML(app.realName || '')}</td>
      <td>${escapeHTML(app.artistName || '')}</td>
      <td>${(app.roles || []).join(', ')}</td>
      <td>${escapeHTML(app.genre || '')}</td>
      <td>${date}</td>
      <td><span class="admin-status ${statusClass}">${app.status || 'pending'}</span></td>
      <td>
        <button class="admin-action-btn admin-action-approve" data-idx="${idx}" data-action="approved">✓</button>
        <button class="admin-action-btn admin-action-reject" data-idx="${idx}" data-action="rejected">✗</button>
      </td>
    `;
    // Click row for detail (but not action buttons)
    tr.addEventListener('click', (e) => {
      if (e.target.closest('.admin-action-btn')) return;
      showApplicationDetail(idx);
    });
    tbody.appendChild(tr);
  });

  // Action buttons
  tbody.querySelectorAll('.admin-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      const action = btn.dataset.action;
      updateApplicationStatus(idx, action);
    });
  });
}

function updateApplicationStatus(idx, newStatus) {
  const apps = getApplications();
  if (!apps[idx]) return;
  apps[idx].status = newStatus;
  saveApplications(apps);

  if (newStatus === 'approved') {
    toast(`${apps[idx].artistName} approved! Welcome to the pack ⚡`, 'success');
  } else if (newStatus === 'rejected') {
    toast(`${apps[idx].artistName} rejected`, 'info');
  }

  renderApplications(document.querySelector('.admin-filter.active')?.dataset.filter || 'all');
}

function showApplicationDetail(idx) {
  const apps = getApplications();
  const app = apps[idx];
  if (!app) return;

  $('atab-applications')?.classList.add('hidden');
  const detail = $('admin-detail');
  const content = $('admin-detail-content');
  if (!detail || !content) return;

  detail.classList.remove('hidden');

  const socials = (app.socials || []).map(s => `<a href="${escapeHTML(s.url)}" target="_blank" rel="noopener" style="color:var(--gold)">${escapeHTML(s.platform)}</a>`).join(', ') || '—';

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="detail-field"><div class="detail-label">Real Name</div><div class="detail-value">${escapeHTML(app.realName || '')}</div></div>
      <div class="detail-field"><div class="detail-label">Artist Name</div><div class="detail-value">${escapeHTML(app.artistName || '')}</div></div>
      <div class="detail-field"><div class="detail-label">Genre</div><div class="detail-value">${escapeHTML(app.genre || '')}</div></div>
      <div class="detail-field"><div class="detail-label">Roles</div><div class="detail-value">${(app.roles || []).join(', ') || '—'}</div></div>
      <div class="detail-field" style="grid-column:1/-1"><div class="detail-label">Skills</div><div class="detail-value">${escapeHTML(app.skills || '')}</div></div>
      <div class="detail-field"><div class="detail-label">Social Links</div><div class="detail-value">${socials}</div></div>
      <div class="detail-field"><div class="detail-label">Music Link</div><div class="detail-value">${app.musicLink ? `<a href="${escapeHTML(app.musicLink)}" target="_blank" rel="noopener" style="color:var(--gold)">${escapeHTML(app.musicLink)}</a>` : '—'}</div></div>
      <div class="detail-field" style="grid-column:1/-1"><div class="detail-label">Why Lightning Wolves?</div><div class="detail-value">${escapeHTML(app.why || '')}</div></div>
      <div class="detail-field"><div class="detail-label">Applied</div><div class="detail-value">${app.appliedAt ? new Date(app.appliedAt).toLocaleString() : '—'}</div></div>
      <div class="detail-field"><div class="detail-label">Status</div><div class="detail-value"><span class="admin-status admin-status-${app.status || 'pending'}">${app.status || 'pending'}</span></div></div>
    </div>
    <div class="detail-field" style="margin-top:16px">
      <div class="detail-label">Admin Notes</div>
      <textarea id="admin-notes-${idx}" rows="3" placeholder="Internal notes..." style="width:100%;margin-top:4px">${escapeHTML(app.adminNotes || '')}</textarea>
    </div>
    <div class="detail-actions">
      <button class="admin-action-btn admin-action-approve" id="detail-approve-${idx}">Approve ✓</button>
      <button class="admin-action-btn admin-action-reject" id="detail-reject-${idx}">Reject ✗</button>
      <button class="admin-action-btn admin-action-pending" id="detail-pending-${idx}">Pending</button>
    </div>
  `;

  $(`detail-approve-${idx}`)?.addEventListener('click', () => { updateApplicationStatus(idx, 'approved'); showApplicationDetail(idx); });
  $(`detail-reject-${idx}`)?.addEventListener('click', () => { updateApplicationStatus(idx, 'rejected'); showApplicationDetail(idx); });
  $(`detail-pending-${idx}`)?.addEventListener('click', () => { updateApplicationStatus(idx, 'pending'); showApplicationDetail(idx); });

  // Save notes on blur
  const notesEl = $(`admin-notes-${idx}`);
  if (notesEl) notesEl.addEventListener('blur', () => {
    const a = getApplications();
    if (a[idx]) { a[idx].adminNotes = notesEl.value; saveApplications(a); }
  });
}

// ─── Admin: Model Health Config ──────────────────────────────────────────────
function renderAdminModels() {
  const list = $('admin-model-list');
  if (!list) return;
  const config = getModelConfig();

  list.innerHTML = '';
  Object.entries(config.models).forEach(([id, model]) => {
    const card = document.createElement('div');
    card.className = 'admin-model-card';
    card.innerHTML = `
      <span class="model-status-dot model-status-${model.status}"></span>
      <div class="admin-model-info">
        <div class="admin-model-name">${escapeHTML(model.name)}</div>
        <div class="admin-model-desc">${escapeHTML(model.description || '')}</div>
      </div>
      <div class="admin-model-controls">
        <div class="admin-model-cost"><input type="number" value="${model.cost}" min="1" data-model="${id}" class="admin-model-cost-input" /><span>⚡</span></div>
        <select data-model="${id}" class="admin-model-status-select" style="font-size:12px;padding:4px">
          <option value="green" ${model.status === 'green' ? 'selected' : ''}>Stable</option>
          <option value="yellow" ${model.status === 'yellow' ? 'selected' : ''}>Degraded</option>
          <option value="red" ${model.status === 'red' ? 'selected' : ''}>Down</option>
        </select>
        <label class="toggle-switch">
          <input type="checkbox" ${model.enabled ? 'checked' : ''} data-model="${id}" class="admin-model-toggle" />
          <span class="toggle-switch-slider"></span>
        </label>
      </div>
    `;
    list.appendChild(card);
  });

  // Wire change events
  list.querySelectorAll('.admin-model-cost-input').forEach(input => {
    input.addEventListener('change', () => {
      const id = input.dataset.model;
      modelConfig.models[id].cost = parseInt(input.value) || 10;
      saveModelConfig();
      updateModelHealthUI();
      toast(`${modelConfig.models[id].name} cost updated to ${input.value} ⚡`, 'success');
    });
  });

  list.querySelectorAll('.admin-model-status-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const id = sel.dataset.model;
      modelConfig.models[id].status = sel.value;
      saveModelConfig();
      updateModelHealthUI();
    });
  });

  list.querySelectorAll('.admin-model-toggle').forEach(toggle => {
    toggle.addEventListener('change', () => {
      const id = toggle.dataset.model;
      modelConfig.models[id].enabled = toggle.checked;
      saveModelConfig();
      updateModelHealthUI();
      toast(`${modelConfig.models[id].name} ${toggle.checked ? 'enabled' : 'disabled'}`, 'info');
    });
  });
}

// ─── Admin: Bug Reports ──────────────────────────────────────────────────────
function renderAdminBugs() {
  const list = $('admin-bug-list');
  if (!list) return;

  const bugs = JSON.parse(localStorage.getItem('lw_bug_reports') || '[]');
  if (bugs.length === 0) {
    list.innerHTML = '<div class="admin-empty">No bug reports yet.</div>';
    return;
  }

  list.innerHTML = '';
  bugs.forEach((bug, idx) => {
    const card = document.createElement('div');
    card.className = 'admin-bug-card';
    card.innerHTML = `
      <div class="admin-bug-desc">${escapeHTML(bug.description || '')}</div>
      <div class="admin-bug-meta">Reported: ${bug.reportedAt ? new Date(bug.reportedAt).toLocaleString() : '—'} · Status: ${bug.status || 'pending'}</div>
      <div class="admin-bug-actions">
        <button class="admin-action-btn admin-action-approve" data-bugidx="${idx}">Confirm & Award ⚡</button>
        <button class="admin-action-btn admin-action-reject" data-bugidx="${idx}">Dismiss</button>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('.admin-action-approve[data-bugidx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.bugidx);
      bugs[idx].status = 'confirmed';
      localStorage.setItem('lw_bug_reports', JSON.stringify(bugs));
      addCredits(10);
      toast('Bug confirmed! +10 ⚡ awarded to reporter', 'success');
      renderAdminBugs();
    });
  });

  list.querySelectorAll('.admin-action-reject[data-bugidx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.bugidx);
      bugs[idx].status = 'dismissed';
      localStorage.setItem('lw_bug_reports', JSON.stringify(bugs));
      toast('Bug dismissed', 'info');
      renderAdminBugs();
    });
  });
}

// ─── Pricing Page ────────────────────────────────────────────────────────────
const PROMO_CODES = {
  'WOLFPACK': { type: 'percent', value: 20, label: '20% off' },
  'LAZYJO':   { type: 'percent', value: 100, label: 'Free month' },
  'STUDIO10': { type: 'percent', value: 10, label: '10% off' },
  'CREDITS50': { type: 'credits', value: 50, label: '+50 bonus Credits ⚡' },
};

let currentBilling = 'monthly';
let appliedPromo = null;

function initPricingPage() {
  // Billing toggle
  document.querySelectorAll('.billing-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.billing-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBilling = btn.dataset.billing;
      updatePlanPrices();
    });
  });

  // Promo code
  const applyBtn = $('promo-apply-btn');
  if (applyBtn) applyBtn.addEventListener('click', applyPromoCode);

  const promoInput = $('promo-input');
  if (promoInput) promoInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyPromoCode();
  });

  // Restore saved promo
  const savedPromo = localStorage.getItem('lw_promo_code');
  if (savedPromo && PROMO_CODES[savedPromo]) {
    appliedPromo = { code: savedPromo, ...PROMO_CODES[savedPromo] };
    showPromoFeedback(true, PROMO_CODES[savedPromo].label);
    updatePlanPrices();
  }
}

function applyPromoCode() {
  const input = $('promo-input');
  const code = input?.value.trim().toUpperCase();
  if (!code) return;

  const promo = PROMO_CODES[code];
  if (promo) {
    appliedPromo = { code, ...promo };
    localStorage.setItem('lw_promo_code', code);
    state.promoCode = code;

    if (promo.type === 'credits') {
      addCredits(promo.value);
      showPromoFeedback(true, `${promo.label} — credits added!`);
    } else {
      showPromoFeedback(true, `${promo.label} applied!`);
    }
    updatePlanPrices();
  } else {
    showPromoFeedback(false, 'Code not recognized');
    // Shake animation
    const row = input?.closest('.promo-input-row');
    if (row) {
      row.classList.add('promo-shake');
      setTimeout(() => row.classList.remove('promo-shake'), 500);
    }
  }
}

function showPromoFeedback(success, message) {
  const feedback = $('promo-feedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.className = `promo-feedback ${success ? 'promo-success' : 'promo-error'}`;
  feedback.classList.remove('hidden');
}

function updatePlanPrices() {
  const isAnnual = currentBilling === 'annual';
  const discount = appliedPromo?.type === 'percent' ? appliedPromo.value : 0;

  document.querySelectorAll('.plan-amount').forEach(el => {
    const monthly = parseFloat(el.dataset.monthly);
    const annual = parseFloat(el.dataset.annual);
    if (isNaN(monthly)) return;

    let price = isAnnual ? Math.round(annual / 12) : monthly;
    let displayPrice = price;

    if (discount > 0) {
      displayPrice = Math.round(price * (1 - discount / 100));
      if (discount === 100) displayPrice = 0;

      // Show old price with strikethrough
      const parent = el.closest('.plan-price');
      let oldEl = parent?.querySelector('.plan-amount-old');
      if (!oldEl) {
        oldEl = document.createElement('span');
        oldEl.className = 'plan-amount-old';
        parent?.insertBefore(oldEl, el);
      }
      oldEl.textContent = `€${price}`;
      oldEl.style.display = '';
    } else {
      const parent = el.closest('.plan-price');
      const oldEl = parent?.querySelector('.plan-amount-old');
      if (oldEl) oldEl.style.display = 'none';
    }

    el.textContent = displayPrice;

    // Update period text
    const periodEl = el.parentElement?.querySelector('.plan-period');
    if (periodEl) periodEl.textContent = isAnnual ? '/mo (billed annually)' : '/mo';
  });
}

// ─── Task Reward System ──────────────────────────────────────────────────────
const TASKS = {
  signup:     { reward: 10, label: 'Sign up with email' },
  youtube:    { reward: 15, label: 'Subscribe on YouTube' },
  rosakay_ig: { reward: 5,  label: 'Follow Rosakay on Instagram' },
  lw_ig:      { reward: 5,  label: 'Follow Lightning Wolves on Instagram' },
};

function initTaskRewards() {
  updateTaskUI();
  updateReferralUI();

  // Signup task
  const signupBtn = $('task-btn-signup');
  if (signupBtn) signupBtn.addEventListener('click', () => {
    if (state.completedTasks.includes('signup')) return;
    window.location.hash = '/auth';
  });

  // YouTube task
  const ytBtn = $('task-btn-youtube');
  if (ytBtn) ytBtn.addEventListener('click', () => {
    if (state.completedTasks.includes('youtube')) return;
    // Open YouTube channel first
    window.open('https://youtube.com/@lightningwolves', '_blank');
    // Try Google OAuth for verification
    const clientId = window.VITE_GOOGLE_CLIENT_ID || '';
    if (clientId) {
      markTaskPending('youtube', ytBtn);
      setTimeout(() => startYouTubeOAuth(), 2000);
    } else {
      // No OAuth configured — use countdown fallback
      startCountdown('youtube', ytBtn, 10);
    }
  });

  // Rosakay Instagram
  const rkBtn = $('task-btn-rosakay_ig');
  if (rkBtn) rkBtn.addEventListener('click', () => {
    if (state.completedTasks.includes('rosakay_ig')) return;
    window.open('https://www.instagram.com/rosakay_officiel', '_blank');
    startCountdown('rosakay_ig', rkBtn, 10);
  });

  // LW Instagram
  const lwBtn = $('task-btn-lw_ig');
  if (lwBtn) lwBtn.addEventListener('click', () => {
    if (state.completedTasks.includes('lw_ig')) return;
    window.open('https://www.instagram.com/lightningwolvesmusic', '_blank');
    startCountdown('lw_ig', lwBtn, 10);
  });

  // Referral share
  const refBtn = $('task-btn-referral');
  if (refBtn) refBtn.addEventListener('click', () => {
    const url = $('referral-url');
    if (url) {
      navigator.clipboard.writeText(url.value).then(() => {
        toast('Referral link copied!', 'success');
      });
    }
  });

  // Referral copy button
  const copyBtn = $('referral-copy-btn');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    const url = $('referral-url');
    if (url) {
      navigator.clipboard.writeText(url.value).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy ⚡'; }, 1500);
      });
    }
  });
}

function startCountdown(taskId, btn, seconds) {
  let remaining = seconds;
  btn.className = 'task-btn task-btn-countdown';
  btn.textContent = `${remaining}s`;

  const interval = setInterval(() => {
    remaining--;
    btn.textContent = `${remaining}s`;
    if (remaining <= 0) {
      clearInterval(interval);
      btn.className = 'task-btn task-btn-earn';
      btn.textContent = 'Claim';
      btn.onclick = () => completeTask(taskId);
    }
  }, 1000);
}

function markTaskPending(taskId, btn) {
  if (!state.pendingTasks.includes(taskId)) {
    state.pendingTasks.push(taskId);
    localStorage.setItem('lw_pending_tasks', JSON.stringify(state.pendingTasks));
  }
  btn.className = 'task-btn task-btn-pending';
  btn.textContent = 'Pending ⏳';
}

function completeTask(taskId) {
  if (state.completedTasks.includes(taskId)) return;
  const task = TASKS[taskId];
  if (!task) return;

  state.completedTasks.push(taskId);
  localStorage.setItem('lw_completed_tasks', JSON.stringify(state.completedTasks));

  // Remove from pending
  state.pendingTasks = state.pendingTasks.filter(t => t !== taskId);
  localStorage.setItem('lw_pending_tasks', JSON.stringify(state.pendingTasks));

  addCredits(task.reward);
  toast(`${task.label} — +${task.reward} ⚡ earned!`, 'success');
  updateTaskUI();
}

function updateTaskUI() {
  const totalEarned = state.completedTasks.reduce((sum, id) => {
    return sum + (TASKS[id]?.reward || 0);
  }, 0) + (state.referralCount * 20);

  // Progress bar
  const fill = $('tasks-progress-fill');
  const label = $('tasks-progress-label');
  if (fill) fill.style.width = `${Math.min(100, (totalEarned / 60) * 100)}%`;
  if (label) label.textContent = `${totalEarned} / 60 ⚡ earned from tasks · 10 ⚡ = 1 generation`;

  // Update each task button state
  Object.keys(TASKS).forEach(taskId => {
    const btn = $(`task-btn-${taskId}`);
    if (!btn) return;

    if (state.completedTasks.includes(taskId)) {
      btn.className = 'task-btn task-btn-earned';
      btn.textContent = 'Earned ✓';
      btn.onclick = null;
    } else if (state.pendingTasks.includes(taskId)) {
      btn.className = 'task-btn task-btn-pending';
      btn.textContent = 'Pending ⏳';
    }
  });

  // Auto-complete signup if user exists
  if (state.user && !state.completedTasks.includes('signup')) {
    completeTask('signup');
  }
}

function updateReferralUI() {
  // Generate referral code
  const userId = state.user?.id || 'guest' + Math.random().toString(36).substring(2, 10);
  const refCode = 'LW-' + userId.substring(0, 8).toUpperCase();

  const urlInput = $('referral-url');
  if (urlInput) urlInput.value = `https://lightningwolves.studio/?ref=${refCode}`;

  const countDisplay = $('referral-count-display');
  const earnedDisplay = $('referral-earned-display');
  if (countDisplay) countDisplay.textContent = state.referralCount;
  if (earnedDisplay) earnedDisplay.textContent = `${state.referralCount * 20} ⚡`;
}

// ─── Export Modal & FFmpeg ────────────────────────────────────────────────────
let selectedRatio = '9:16';

function openExportModal() {
  const overlay = $('export-modal-overlay');
  if (!overlay) return;

  // Update watermark info based on user status
  const isMember = state.profile?.role === 'member' || state.profile?.role === 'admin';
  const wmInfo = $('export-watermark-info');
  if (wmInfo) {
    if (isMember) {
      wmInfo.className = 'export-watermark-info export-no-watermark';
      wmInfo.querySelector('.export-wm-badge').textContent = 'No watermark (member)';
      wmInfo.querySelector('.export-wm-hint').textContent = 'Your export will be clean';
    } else {
      wmInfo.className = 'export-watermark-info';
      wmInfo.querySelector('.export-wm-badge').textContent = 'Watermark: "Made with LW Studio ⚡"';
      wmInfo.querySelector('.export-wm-hint').textContent = 'Members export without watermark';
    }
  }

  // Reset progress
  const progress = $('export-progress');
  if (progress) progress.classList.add('hidden');

  overlay.classList.remove('hidden');

  // Ratio toggle
  document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRatio = btn.dataset.ratio;
    });
  });

  // Close
  $('export-modal-close')?.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); });

  // Start export
  const startBtn = $('export-start-btn');
  if (startBtn) {
    startBtn.onclick = () => runExport();
  }
}

async function runExport() {
  const progress = $('export-progress');
  const progressFill = $('export-progress-fill');
  const progressText = $('export-progress-text');
  const startBtn = $('export-start-btn');

  if (progress) progress.classList.remove('hidden');
  if (startBtn) { startBtn.disabled = true; startBtn.textContent = 'Exporting...'; }
  if (progressFill) progressFill.style.width = '0%';
  if (progressText) progressText.textContent = 'Preparing canvas frames...';

  const isMember = state.profile?.role === 'member' || state.profile?.role === 'admin';
  const isPortrait = selectedRatio === '9:16';
  const w = isPortrait ? 1080 : 1920;
  const h = isPortrait ? 1920 : 1080;

  try {
    // Get lyrics for rendering
    const lyrics = state.lastPack?.lyrics || [];
    const activePreset = document.querySelector('.preset-card.active');
    const styleName = activePreset?.dataset.preset || 'karaoke';

    // Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Generate frames (30fps, ~10 seconds for demo)
    const fps = 30;
    const durationSec = Math.max(10, lyrics.length * 2);
    const totalFrames = fps * durationSec;
    const frames = [];

    if (progressText) progressText.textContent = 'Rendering frames...';

    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;

      // Background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      // Find current lyric
      const lineIndex = Math.min(Math.floor(t / 2), lyrics.length - 1);
      const line = lyrics[lineIndex];
      if (line && !/^\[.+\]$/.test(line.text || '')) {
        // Draw lyrics based on style
        drawLyricFrame(ctx, w, h, line.text, styleName, t);
      }

      // Watermark for free users
      if (!isMember) {
        ctx.save();
        ctx.font = `${Math.round(w * 0.018)}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.textAlign = 'right';
        ctx.fillText('Made with LW Studio ⚡', w - 20, h - 20);
        ctx.restore();
      }

      // Capture frame as blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const buffer = await blob.arrayBuffer();
      frames.push(new Uint8Array(buffer));

      // Update progress
      if (i % 10 === 0) {
        const pct = Math.round((i / totalFrames) * 60);
        if (progressFill) progressFill.style.width = `${pct}%`;
      }
    }

    if (progressText) progressText.textContent = 'Encoding MP4 with FFmpeg...';
    if (progressFill) progressFill.style.width = '60%';

    // Try FFmpeg.wasm
    if (window.FFmpeg && window.FFmpegUtil) {
      await encodeWithFFmpeg(frames, w, h, fps, progressFill, progressText);
    } else {
      // Fallback: export as WebM via MediaRecorder from canvas
      await exportCanvasFallback(canvas, lyrics, w, h, fps, durationSec, isMember, styleName, progressFill, progressText);
    }

    if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Export ⚡'; }
    toast('Export complete! Download started.', 'success');
    if (progressFill) progressFill.style.width = '100%';
    if (progressText) progressText.textContent = 'Done!';

  } catch (err) {
    console.error('Export error:', err);
    toast('Export failed: ' + err.message, 'error');
    if (startBtn) { startBtn.disabled = false; startBtn.textContent = 'Export ⚡'; }
    if (progressText) progressText.textContent = 'Failed';
  }
}

function drawLyricFrame(ctx, w, h, text, style, t) {
  ctx.save();
  const fontSize = Math.round(w * 0.045);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  switch (style) {
    case 'karaoke':
      ctx.font = `500 ${fontSize}px Inter, sans-serif`;
      const words = text.split(/\s+/);
      const wordIndex = Math.floor((t % 2) / (2 / words.length));
      let xPos = w / 2 - ctx.measureText(text).width / 2;
      words.forEach((word, i) => {
        ctx.fillStyle = i <= wordIndex ? '#f5c518' : 'rgba(255,255,255,0.5)';
        ctx.fillText(word + ' ', xPos + ctx.measureText(words.slice(0, i).join(' ') + (i > 0 ? ' ' : '')).width, h / 2);
      });
      // Simple centered fallback
      ctx.fillStyle = '#f5c518';
      ctx.fillText(text, w / 2, h / 2);
      break;
    case 'knockout':
    case 'ghost':
    case 'phantom':
    case 'eclipse':
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.font = `${style === 'ghost' ? '800' : style === 'phantom' ? 'italic 400' : '600'} ${fontSize * 1.3}px ${style === 'phantom' || style === 'eclipse' ? 'Georgia, serif' : 'Inter, sans-serif'}`;
      ctx.fillStyle = '#000';
      ctx.fillText(text, w / 2, h / 2);
      break;
    case 'glitch':
      ctx.font = `500 ${fontSize}px monospace`;
      ctx.fillStyle = '#f0f';
      ctx.fillText(text, w / 2 + 2, h / 2 - 1);
      ctx.fillStyle = '#0ff';
      ctx.fillText(text, w / 2 - 2, h / 2 + 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, w / 2, h / 2);
      break;
    case 'hotpink':
      ctx.font = `500 ${fontSize}px Inter, sans-serif`;
      ctx.shadowColor = '#ff69b4';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff69b4';
      ctx.fillText(text, w / 2, h / 2);
      break;
    case 'fly':
      ctx.font = `600 ${fontSize}px Raleway, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#fff';
      ctx.fillText(text, w / 2, h / 2);
      break;
    case 'minimal':
      ctx.font = `400 ${Math.round(fontSize * 0.85)}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(text, w / 2, h / 2);
      break;
    case 'subtitle':
      ctx.font = `400 ${Math.round(fontSize * 0.9)}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const tw = ctx.measureText(text).width;
      ctx.fillRect(w / 2 - tw / 2 - 12, h - 80 - fontSize / 2, tw + 24, fontSize + 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, w / 2, h - 72);
      break;
    default: // pop
      ctx.font = `700 ${Math.round(fontSize * 1.2)}px Inter, sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.fillText(text, w / 2, h / 2);
      break;
  }
  ctx.restore();
}

async function encodeWithFFmpeg(frames, w, h, fps, progressFill, progressText) {
  const { FFmpeg } = window.FFmpeg;
  const { fetchFile } = window.FFmpegUtil;

  const ffmpeg = new FFmpeg();
  await ffmpeg.load({ coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js' });

  // Write frames
  for (let i = 0; i < frames.length; i++) {
    const name = `frame${String(i).padStart(5, '0')}.png`;
    await ffmpeg.writeFile(name, frames[i]);
    if (i % 20 === 0) {
      const pct = 60 + Math.round((i / frames.length) * 30);
      if (progressFill) progressFill.style.width = `${pct}%`;
    }
  }

  if (progressText) progressText.textContent = 'Encoding video...';

  await ffmpeg.exec([
    '-framerate', String(fps),
    '-i', 'frame%05d.png',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'ultrafast',
    'output.mp4'
  ]);

  if (progressFill) progressFill.style.width = '95%';
  if (progressText) progressText.textContent = 'Preparing download...';

  const data = await ffmpeg.readFile('output.mp4');
  const blob = new Blob([data], { type: 'video/mp4' });
  downloadBlob(blob, 'lyric-video.mp4');
}

async function exportCanvasFallback(canvas, lyrics, w, h, fps, durationSec, isMember, styleName, progressFill, progressText) {
  if (progressText) progressText.textContent = 'Recording canvas...';

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
  const chunks = [];

  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      downloadBlob(blob, 'lyric-video.webm');
      resolve();
    };
    recorder.onerror = reject;
    recorder.start();

    const ctx = canvas.getContext('2d');
    let frame = 0;
    const totalFrames = fps * Math.min(durationSec, 15);

    const renderFrame = () => {
      if (frame >= totalFrames) {
        recorder.stop();
        return;
      }
      const t = frame / fps;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      const lineIndex = Math.min(Math.floor(t / 2), lyrics.length - 1);
      const line = lyrics[lineIndex];
      if (line && !/^\[.+\]$/.test(line.text || '')) {
        drawLyricFrame(ctx, w, h, line.text, styleName, t);
      }

      if (!isMember) {
        ctx.save();
        ctx.font = `${Math.round(w * 0.018)}px Inter, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.textAlign = 'right';
        ctx.fillText('Made with LW Studio ⚡', w - 20, h - 20);
        ctx.restore();
      }

      frame++;
      const pct = 60 + Math.round((frame / totalFrames) * 35);
      if (progressFill) progressFill.style.width = `${pct}%`;

      requestAnimationFrame(renderFrame);
    };

    renderFrame();
  });
}

function downloadBlob(blob, filename) {
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

  // Check if it's a generation limit issue (3 free) or credit issue
  const isLimitHit = state.genCount >= 3 && !state.user;
  const title = isLimitHit
    ? "You've used your 3 free generations. ⚡"
    : "Not enough credits ⚡";
  const desc = isLimitHit
    ? "Sign in or sign up to continue. Earn free credits from tasks!"
    : "You need 10 ⚡ to generate. Earn credits from tasks or upgrade your plan.";

  box.innerHTML = `
    <div style="text-align:center">
      <div style="font-size:32px;margin-bottom:12px">⚡</div>
      <h3 style="font-size:18px;font-weight:500;margin-bottom:8px">${title}</h3>
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:24px">${desc}</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <a href="#/auth" class="btn-gold btn-full" id="modal-signin-btn">Sign In</a>
        <a href="#/pricing" class="btn-outline btn-full" id="modal-pricing-btn">Get Access</a>
        <a href="#/pricing" class="btn-ghost btn-full" id="modal-tasks-btn" style="font-size:12px">Earn free credits →</a>
      </div>
    </div>
  `;
  overlay.classList.remove('hidden');

  $('modal-signin-btn')?.addEventListener('click', () => overlay.classList.add('hidden'));
  $('modal-pricing-btn')?.addEventListener('click', () => overlay.classList.add('hidden'));
  $('modal-tasks-btn')?.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.add('hidden'); }, { once: true });
}

// ─── Auth Page ───────────────────────────────────────────────────────────────
function initAuthPage() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isSignin = tab.dataset.authtab === 'signin';
      const signinForm = $('auth-signin-form');
      const signupForm = $('auth-signup-form');
      if (signinForm) signinForm.classList.toggle('hidden', !isSignin);
      if (signupForm) signupForm.classList.toggle('hidden', isSignin);
    });
  });

  // Sign In
  const signinForm = $('auth-signin-form');
  if (signinForm) signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('auth-signin-email')?.value.trim();
    const pass = $('auth-signin-password')?.value;
    const errEl = $('auth-signin-error');
    if (errEl) errEl.classList.add('hidden');

    if (!supabase) {
      showAuthError(errEl, 'Auth not configured. Set up Supabase.');
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) return showAuthError(errEl, error.message);

    state.user = data.user;
    state.token = data.session.access_token;
    await loadProfile();
    mergeLocalStorageToAccount();
    updateTopbarAuth();
    updateTaskUI();
    toast('Signed in!', 'success');
    window.location.hash = '/';
  });

  // Sign Up
  const signupForm = $('auth-signup-form');
  if (signupForm) signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('auth-signup-email')?.value.trim();
    const pass = $('auth-signup-password')?.value;
    const promo = $('auth-signup-promo')?.value.trim().toUpperCase();
    const errEl = $('auth-signup-error');
    if (errEl) errEl.classList.add('hidden');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, promoCode: promo }),
      });
      const json = await res.json();
      if (!res.ok) return showAuthError(errEl, json.error);

      // Apply promo code if valid
      if (promo && PROMO_CODES[promo]) {
        const promoData = PROMO_CODES[promo];
        if (promoData.type === 'credits') {
          addCredits(promoData.value);
        }
        localStorage.setItem('lw_promo_code', promo);
        state.promoCode = promo;
      }

      // Auto sign in
      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) {
          toast('Account created! Please sign in.', 'success');
          document.querySelector('.auth-tab[data-authtab="signin"]')?.click();
          return;
        }
        state.user = data.user;
        state.token = data.session.access_token;
        await loadProfile();
      }

      mergeLocalStorageToAccount();
      updateTopbarAuth();
      updateTaskUI();
      toast('Account created! Welcome to the pack.', 'success');
      window.location.hash = '/';
    } catch (err) {
      showAuthError(errEl, err.message);
    }
  });

  // Continue as Guest
  const guestBtn = $('auth-guest-btn');
  if (guestBtn) guestBtn.addEventListener('click', () => {
    window.location.hash = '/';
  });

  // Init particles
  initAuthParticles();
}

function showAuthError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ─── Auth Particle Background ────────────────────────────────────────────────
function initAuthParticles() {
  const canvas = $('auth-particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
    canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const particles = [];
  for (let i = 0; i < 60; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.3 + 0.1,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245, 197, 24, ${p.alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

// ─── Dev Debug Panel ─────────────────────────────────────────────────────────
function initDebugPanel() {
  // Only show in dev mode (localhost or ?debug=1)
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || new URLSearchParams(window.location.search).has('debug');
  const panel = $('debug-panel');
  if (!isDev || !panel) return;
  panel.classList.remove('hidden');

  // Toggle collapse
  const toggle = $('debug-toggle');
  const body = $('debug-body');
  if (toggle && body) {
    toggle.addEventListener('click', () => {
      body.classList.toggle('hidden');
      toggle.textContent = body.classList.contains('hidden') ? '+' : '−';
    });
  }

  // Add credits
  $('dbg-add-credits')?.addEventListener('click', () => {
    addCredits(10);
    updateDebugPanel();
    toast('Debug: +10 ⚡ added', 'success');
  });

  // Simulate referral
  $('dbg-sim-referral')?.addEventListener('click', () => {
    state.referralCount++;
    localStorage.setItem('lw_referral_count', state.referralCount);
    addCredits(20);
    updateDebugPanel();
    updateReferralUI();
    toast('Debug: Simulated referral signup (+20 ⚡)', 'success');
  });

  // Reset everything
  $('dbg-reset')?.addEventListener('click', () => {
    localStorage.clear();
    state.credits = 0;
    state.completedTasks = [];
    state.pendingTasks = [];
    state.genCount = 0;
    state.referralCount = 0;
    state.promoCode = '';
    state.refCode = '';
    updateCreditDisplay();
    updateDebugPanel();
    toast('Debug: All localStorage cleared', 'info');
  });

  updateDebugPanel();
  // Refresh debug panel every 2 seconds
  setInterval(updateDebugPanel, 2000);
}

function updateDebugPanel() {
  const dbgCredits = $('dbg-credits');
  const dbgTasks = $('dbg-tasks');
  const dbgOauth = $('dbg-oauth');
  const dbgGens = $('dbg-gens');
  const dbgRef = $('dbg-ref');
  const dbgRefCount = $('dbg-refcount');

  if (dbgCredits) dbgCredits.textContent = state.credits;
  if (dbgTasks) dbgTasks.textContent = state.completedTasks.length > 0 ? state.completedTasks.join(', ') : 'none';
  if (dbgOauth) dbgOauth.textContent = state.user ? 'Signed in' : 'Guest';
  if (dbgGens) dbgGens.textContent = state.genCount;
  if (dbgRef) dbgRef.textContent = state.refCode || 'none';
  if (dbgRefCount) dbgRefCount.textContent = state.referralCount;
}

// ─── Onboarding Tooltips ─────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  'Upload your track ⚡',
  'We sync your lyrics automatically',
  'Pick your style',
  'Generate your background',
  'Export and share',
];

function initOnboarding() {
  // Only show once (first visit)
  if (localStorage.getItem('lw_onboarding_done')) return;

  // Only show on studio page
  const showOnboarding = () => {
    if (state.currentPage !== 'studio') return;
    const overlay = $('onboarding-overlay');
    if (!overlay) return;

    let currentStep = 0;

    function renderStep() {
      const indicator = $('onboarding-step-indicator');
      const text = $('onboarding-text');
      const nextBtn = $('onboarding-next');

      if (indicator) {
        indicator.innerHTML = ONBOARDING_STEPS.map((_, i) =>
          `<div class="onboarding-dot ${i === currentStep ? 'active' : ''}"></div>`
        ).join('');
      }
      if (text) text.textContent = ONBOARDING_STEPS[currentStep];
      if (nextBtn) nextBtn.textContent = currentStep === ONBOARDING_STEPS.length - 1 ? 'Done' : 'Next';
    }

    overlay.classList.remove('hidden');
    renderStep();

    $('onboarding-next')?.addEventListener('click', () => {
      currentStep++;
      if (currentStep >= ONBOARDING_STEPS.length) {
        dismissOnboarding();
      } else {
        renderStep();
      }
    });

    $('onboarding-skip')?.addEventListener('click', dismissOnboarding);
  };

  function dismissOnboarding() {
    const overlay = $('onboarding-overlay');
    if (overlay) overlay.classList.add('hidden');
    localStorage.setItem('lw_onboarding_done', '1');
  }

  // Show when navigating to studio for the first time
  window.addEventListener('hashchange', () => {
    if (state.currentPage === 'studio' && !localStorage.getItem('lw_onboarding_done')) {
      setTimeout(showOnboarding, 500);
    }
  });
}

// ─── Error Helpers ───────────────────────────────────────────────────────────
function mapErrorMessage(text, status) {
  const lower = (text || '').toLowerCase();
  if (status === 413 || lower.includes('too large') || lower.includes('limit')) return 'File too large. Max 100MB.';
  if (lower.includes('no lyrics') || lower.includes('no speech')) return "Couldn't detect lyrics. Try a cleaner audio file or add lyrics manually.";
  if (lower.includes('transcri')) return 'Transcription failed. Please try again.';
  return text || 'Something went wrong. Please try again.';
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
async function init() {
  console.log('[LW] init() starting');

  // Initialize each module in try-catch so one failure doesn't kill the rest
  var modules = [
    ['Router', initRouter],
    ['TopbarAuth', initTopbarAuth],
    ['CreditPill', initCreditPill],
    ['BugReport', initBugReport],
    ['AuthPage', initAuthPage],
    ['CrewPage', initCrewPage],
    ['StudioLeft', initStudioLeft],
    ['StudioCenter', initStudioCenter],
    ['StudioRight', initStudioRight],
    ['PerWordStyling', initPerWordStyling],
    ['ModelSelection', initModelSelection],
    ['PerformanceTab', initPerformanceTab],
    ['RemixTab', initRemixTab],
    ['HooksPanel', initHooksPanel],
    ['JoinPage', initJoinPage],
    ['AdminDashboard', initAdminDashboard],
    ['PricingPage', initPricingPage],
    ['TaskRewards', initTaskRewards],
    ['Downloads', initDownloads],
    ['DebugPanel', initDebugPanel],
    ['Onboarding', initOnboarding],
    ['CreditDisplay', updateCreditDisplay],
  ];

  for (var i = 0; i < modules.length; i++) {
    try { modules[i][1](); } catch (e) { console.error('[LW] ' + modules[i][0] + ' failed:', e); }
  }

  console.log('[LW] all modules initialized');

  // Network-dependent init (non-blocking)
  try { checkReferralCode(); } catch(e) {}
  try { initGoogleOAuth(); } catch(e) {}
  try {
    await initSupabase();
    await checkSession();
    if (state.user) mergeLocalStorageToAccount();
  } catch (e) {
    console.warn('[LW] Auth init failed:', e);
  }
  try { updateTopbarAuth(); } catch(e) {}

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
        mergeLocalStorageToAccount();
        updateTaskUI();
        updateReferralUI();
      } else {
        state.user = null;
        state.token = null;
        state.profile = null;
      }
      updateTopbarAuth();
      updateCreditDisplay();
    });
  }
}

// Start the app — handle both cases: DOM already loaded or not yet
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
console.log('[LW] bootstrap registered, readyState:', document.readyState);
