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
