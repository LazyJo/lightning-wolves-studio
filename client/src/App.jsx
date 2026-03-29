import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

// ─── Wolf data ────────────────────────────────────────────────────────────────
const WOLVES = [
  { id: 'yellow',     color: '#f5c518', artist: 'Lazy Jo',        genre: 'Melodic Hip-Hop',   image: 'wolf-yellow.png', video: 'wolf-yellow.mp4',     locked: false },
  { id: 'purple',     color: '#9b6dff', artist: 'Zirka',          genre: 'French Hip-Hop',    image: 'wolf-purple.png', video: 'Wolf-Purple.mp4',     locked: false },
  { id: 'orange',     color: '#e8870a', artist: 'Rosakay',        genre: 'Pop / French Pop',  image: 'wolf-orange.png', video: 'Wolf-Orange.mp4',     locked: false },
  { id: 'white-blue', color: '#64b5f6', artist: 'Drippydesigns',  genre: 'Visual / Creative', image: 'wolf-white.svg',  video: 'wolf-white-blue.mp4', locked: false },
  { id: 'green',      color: '#00E64D', artist: 'Shiteux',        genre: 'Visual',            image: 'wolf-green.png',  video: 'wolf-green.mp4',      locked: false },
  { id: 'black',  color: '#111111', locked: true, image: 'wolf-black.svg' },
  { id: 'blue',   color: '#2196F3', locked: true, image: 'wolf-blue.svg'  },
  { id: 'pink',   color: '#E040FB', locked: true, image: 'wolf-pink.svg'  },
  { id: 'red',    color: '#E53935', locked: true, image: 'wolf-red.svg'   },
  { id: 'gray',   color: '#9E9E9E', locked: true, image: 'wolf-gray.svg'  },
]

const PACK_MEMBERS = [
  { name: 'Lazy Jo',        role: 'Melodic Hip-Hop', tag: 'Founder · Producer', color: '#f5c518', image: 'wolf-yellow.png' },
  { name: 'Rosakay',        role: 'Pop / French Pop', tag: 'Artist',             color: '#e8870a', image: 'wolf-orange.png' },
  { name: 'Zirka',          role: 'French Hip-Hop',   tag: 'Artist',             color: '#9b6dff', image: 'wolf-purple.png' },
  { name: 'Drippydesigns',  role: 'Artwork · Covers', tag: 'Creative Director',  color: '#64b5f6', image: 'drippydesigns-logo.png', emoji: null, halfColor: '#e8e8e8' },
  { name: 'Shiteux',        role: 'Photos & Videos',  tag: 'Visuals',            color: '#00E64D', image: 'wolf-green.png', emoji: null },
]

const WOLF_NAMES = PACK_MEMBERS.map(m => m.name)

const TIP_ICONS = ['📱', '🎬', '▶️', '🎨', '🔊', '💡', '🌟', '🎯']

// ─── localStorage helpers ────────────────────────────────────────────────────
const LONE_WOLF_LIMIT = 3
const LW_GEN_KEY     = 'lw_lone_wolf_gens'
const LW_TRACKS_KEY  = 'lw_saved_tracks'
const LW_VISUALS_KEY = 'lw_visuals'
const LW_COVERS_KEY  = 'lw_covers'
const LW_COLLABS_KEY = 'lw_collabs'

function getLoneWolfGenCount() {
  try {
    const data = JSON.parse(localStorage.getItem(LW_GEN_KEY))
    if (!data) return 0
    const now = new Date()
    const key = `${now.getFullYear()}-${now.getMonth()}`
    return data.month === key ? (data.count || 0) : 0
  } catch { return 0 }
}

function incrementLoneWolfGenCount() {
  const now = new Date()
  const key = `${now.getFullYear()}-${now.getMonth()}`
  const count = getLoneWolfGenCount() + 1
  localStorage.setItem(LW_GEN_KEY, JSON.stringify({ month: key, count }))
}

function lsGet(key) { try { return JSON.parse(localStorage.getItem(key)) || [] } catch { return [] } }
function lsSet(key, v) { localStorage.setItem(key, JSON.stringify(v)) }

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function downloadText(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Lightning Canvas ─────────────────────────────────────────────────────────
function LightningCanvas({ wolfColor }) {
  const canvasRef = useRef(null)
  const colorRef  = useRef(wolfColor)

  useEffect(() => { colorRef.current = wolfColor }, [wolfColor])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let W, H, particles = [], bolts = [], boltTimer = 0, rafId

    function resize() {
      W = canvas.width  = window.innerWidth
      H = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    class Particle {
      constructor() { this.reset() }
      reset() {
        this.x      = Math.random() * W
        this.y      = Math.random() * H
        this.size   = Math.random() * 2 + 0.5
        this.speedX = (Math.random() - 0.5) * 0.4
        this.speedY = -Math.random() * 0.6 - 0.1
        this.life   = 1
        this.decay  = Math.random() * 0.003 + 0.001
        this.color  = colorRef.current || '#f5c518'
      }
      update() {
        this.x += this.speedX; this.y += this.speedY; this.life -= this.decay
        if (this.life <= 0 || this.y < -10) this.reset()
      }
      draw() {
        ctx.save(); ctx.globalAlpha = this.life * 0.35
        ctx.fillStyle = this.color; ctx.shadowBlur = 6; ctx.shadowColor = this.color
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill(); ctx.restore()
      }
    }

    class Bolt {
      constructor() { this.reset() }
      reset() {
        this.x = Math.random() * W; this.y = 0; this.segments = []
        const segs = Math.floor(Math.random() * 6 + 4)
        let cx = this.x, cy = 0
        for (let i = 0; i < segs; i++) {
          cx += (Math.random() - 0.5) * 60; cy += H / segs
          this.segments.push({ x: cx, y: cy })
        }
        this.life = 1; this.decay = Math.random() * 0.06 + 0.04
        this.color = colorRef.current || '#f5c518'
      }
      update() { this.life -= this.decay }
      draw() {
        if (this.life <= 0) return
        ctx.save(); ctx.globalAlpha = this.life * 0.08
        ctx.strokeStyle = this.color; ctx.lineWidth = 1
        ctx.shadowBlur = 12; ctx.shadowColor = this.color
        ctx.beginPath(); ctx.moveTo(this.x, 0)
        this.segments.forEach(s => ctx.lineTo(s.x, s.y))
        ctx.stroke(); ctx.restore()
      }
    }

    for (let i = 0; i < 80; i++) particles.push(new Particle())

    function loop() {
      ctx.clearRect(0, 0, W, H)
      particles.forEach(p => { p.update(); p.draw() })
      boltTimer++
      if (boltTimer > 120 + Math.random() * 180) { bolts.push(new Bolt()); boltTimer = 0 }
      bolts = bolts.filter(b => b.life > 0)
      bolts.forEach(b => { b.update(); b.draw() })
      rafId = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} id="lightning-canvas" />
}

// ─── Auth Page ────────────────────────────────────────────────────────────────
function AuthPage({ supabase, onAuth, onGuest }) {
  const [tab,         setTab]         = useState('login')
  const [loginEmail,  setLoginEmail]  = useState('')
  const [loginPass,   setLoginPass]   = useState('')
  const [loginErr,    setLoginErr]    = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPass,  setSignupPass]  = useState('')
  const [signupPromo, setSignupPromo] = useState('')
  const [signupErr,   setSignupErr]   = useState('')

  async function handleLogin(e) {
    e.preventDefault(); setLoginErr('')
    if (!supabase) { setLoginErr('Auth not configured. Please set up Supabase.'); return }
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass })
    if (error) { setLoginErr(error.message); return }
    onAuth(data.user, data.session.access_token)
  }

  async function handleSignup(e) {
    e.preventDefault(); setSignupErr('')
    const res  = await fetch('/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: signupEmail, password: signupPass, promoCode: signupPromo.toUpperCase() }),
    })
    const json = await res.json()
    if (!res.ok) { setSignupErr(json.error); return }
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: signupEmail, password: signupPass })
      if (error) { setSignupErr('Account created! Please sign in.'); return }
      onAuth(data.user, data.session.access_token)
    } else {
      onAuth(null, null)
    }
  }

  return (
    <div id="auth-page" className="page">
      <div className="auth-container">
        <img src="/logo.svg" alt="Lightning Wolves" className="auth-logo" onError={e => e.target.style.display='none'} />
        <div className="auth-wordmark">LIGHTNING WOLVES</div>
        <div className="auth-sub">Lyrics Studio</div>

        <div className="auth-tabs">
          <button className={`auth-tab${tab==='login'?' active':''}`} onClick={() => setTab('login')}>Sign In</button>
          <button className={`auth-tab${tab==='signup'?' active':''}`} onClick={() => setTab('signup')}>Sign Up</button>
        </div>

        {tab === 'login' && (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="field-group"><label>Email</label>
              <input type="email" placeholder="your@email.com" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} /></div>
            <div className="field-group"><label>Password</label>
              <input type="password" placeholder="••••••••" required value={loginPass} onChange={e => setLoginPass(e.target.value)} /></div>
            {loginErr && <div className="auth-error">{loginErr}</div>}
            <button type="submit" className="btn-gold btn-full">SIGN IN</button>
            <p className="auth-link">No account? <a href="#" onClick={e => { e.preventDefault(); setTab('signup') }}>Create one</a></p>
          </form>
        )}

        {tab === 'signup' && (
          <form className="auth-form" onSubmit={handleSignup}>
            <div className="field-group"><label>Email</label>
              <input type="email" placeholder="your@email.com" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)} /></div>
            <div className="field-group"><label>Password</label>
              <input type="password" placeholder="Min 8 characters" required value={signupPass} onChange={e => setSignupPass(e.target.value)} /></div>
            <div className="field-group">
              <label>Promo Code <span className="label-optional">(optional)</span></label>
              <input type="text" placeholder="e.g. LAZYJO" style={{textTransform:'uppercase'}} value={signupPromo} onChange={e => setSignupPromo(e.target.value)} />
            </div>
            {signupErr && <div className="auth-error">{signupErr}</div>}
            <button type="submit" className="btn-gold btn-full">CREATE ACCOUNT</button>
            <p className="auth-link">Have an account? <a href="#" onClick={e => { e.preventDefault(); setTab('login') }}>Sign in</a></p>
          </form>
        )}

        <button className="btn-ghost btn-full" onClick={onGuest}>Continue as Guest</button>
      </div>
    </div>
  )
}

// ─── Wolf Select Page ─────────────────────────────────────────────────────────
function WolfSelectPage({ onSelectWolf }) {
  return (
    <div id="wolf-select-page" className="page">
      <header className="select-header">
        <img src="/logo.png" alt="Lightning Wolves" className="header-logo" onError={e => e.target.style.display='none'} />
      </header>

      <main className="select-main">
        <h1 className="select-tagline">WHICH WOLF ARE YOU?</h1>
        <div className="wolf-grid">
          {WOLVES.map(wolf => (
            wolf.locked ? (
              <div key={wolf.id} className="wolf-card locked">
                <div className="wolf-img-wrap locked-wrap">
                  <img src={`/${wolf.image}`} alt="Coming Soon" onError={e => e.target.parentElement.innerHTML='<div class="lock-icon">🔒</div>'} />
                  <div className="wolf-lock-overlay">🔒</div>
                </div>
                <div className="wolf-name">???</div>
                <div className="wolf-genre-tag locked-tag">Coming Soon</div>
              </div>
            ) : (
              <div key={wolf.id} className="wolf-card active" onClick={() => onSelectWolf(wolf)}>
                <div className="wolf-img-wrap">
                  {wolf.video
                    ? <video className="wolf-video" src={`/${wolf.video}`} autoPlay loop muted playsInline
                        onError={e => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='block') }} />
                    : null}
                  <img className="wolf-fallback-img" src={`/${wolf.image}`} alt={wolf.artist}
                    style={wolf.video ? {display:'none'} : {}} onError={e => e.target.style.display='none'} />
                  <div className="wolf-glow" style={{'--glow-color': wolf.color}}></div>
                </div>
                <div className="wolf-name">{wolf.artist}</div>
                <div className="wolf-genre-tag" style={{'--tag-color': wolf.color}}>{wolf.genre}</div>
              </div>
            )
          ))}
        </div>

        <div className="lone-wolf-section">
          <div className="lone-wolf-divider">
            <span className="lone-wolf-divider-line"></span>
            <span className="lone-wolf-divider-text">Not in the pack yet?</span>
            <span className="lone-wolf-divider-line"></span>
          </div>
          <div className="lone-wolf-card">
            <div className="lone-wolf-icon">
              <img src="/wolf-gray.svg" alt="Lone Wolf" className="lone-wolf-img" onError={e => e.target.parentElement.textContent='🐺'} />
            </div>
            <div className="lone-wolf-info">
              <div className="lone-wolf-title">Lone Wolf</div>
              <div className="lone-wolf-desc">Try the Studio with 3 free generations — no account needed.</div>
            </div>
            <button className="btn-outline btn-lone-wolf" onClick={() => onSelectWolf({ id: 'lone-wolf', color: '#9E9E9E', artist: '', genre: '', image: 'wolf-gray.svg' })}>
              Enter as Lone Wolf
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Studio Page ──────────────────────────────────────────────────────────────
function StudioPage({ wolf, user, profile, token, supabase, onChangeWolf, onShowAuth, onSignOut, onOpenDashboard, onShowLimitModal, onShowUpgradeModal }) {
  const [title,        setTitle]        = useState('')
  const [artist,       setArtist]       = useState(wolf?.artist || '')
  const [genre,        setGenre]        = useState(wolf?.genre?.split(' /')[0] || '')
  const [bpm,          setBpm]          = useState('')
  const [language,     setLanguage]     = useState('English')
  const [mood,         setMood]         = useState('')
  const [generating,   setGenerating]   = useState(false)
  const [genError,     setGenError]     = useState('')
  const [pack,         setPack]         = useState(null)
  const [meta,         setMeta]         = useState(null)
  const [activeTab,    setActiveTab]    = useState('lyrics')
  const [uploadInfo,   setUploadInfo]   = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [dragover,     setDragover]     = useState(false)
  const [savedMsg,     setSavedMsg]     = useState('')
  const fileInputRef = useRef(null)
  const isLoneWolf = !user && wolf?.id === 'lone-wolf'

  // Restore last pack from localStorage on mount
  useEffect(() => {
    try {
      const savedPack = localStorage.getItem('lw_last_pack')
      const savedMeta = localStorage.getItem('lw_last_meta')
      if (savedPack && savedMeta) {
        setPack(JSON.parse(savedPack))
        setMeta(JSON.parse(savedMeta))
      }
    } catch { /* ignore */ }
  }, [])

  function handleFile(file) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1)
    if (file.size > 100 * 1024 * 1024) {
      setUploadInfo({ text: `File too large (max 100 MB)`, color: '#ff4455' })
      return
    }
    setUploadedFile(file)
    setUploadInfo({ text: `✓ ${file.name} · ${sizeMB} MB`, color: '#3ddc84' })
  }

  async function handleGenerate() {
    setGenError('')
    if (!title || !artist || !genre) { setGenError('Please fill in Song Title, Artist Name, and Genre.'); return }
    if (isLoneWolf && getLoneWolfGenCount() >= LONE_WOLF_LIMIT) { onShowUpgradeModal(); return }
    if (generating) return
    setGenerating(true)
    setPack(null); setMeta(null)
    try {
      // ── Whisper transcription via /api/transcribe ──────────────────────
      let transcriptLines = null
      if (uploadedFile) {
        setUploadInfo({ text: `Transcribing ${uploadedFile.name}…`, color: null })
        const fd = new FormData()
        fd.append('file', uploadedFile)
        const transcribeRes = await fetch('/api/transcribe', { method: 'POST', body: fd })
        const transcribeData = await transcribeRes.json()
        if (!transcribeRes.ok) {
          setUploadInfo({ text: `Transcription error: ${transcribeData.error}`, color: '#ff4455' })
          setGenerating(false)
          return
        }
        transcriptLines = transcribeData.transcriptLines || null
        if (transcriptLines?.length) {
          setUploadInfo({ text: `✓ Transcribed · ${transcriptLines.length} lines`, color: '#3ddc84' })
        } else {
          setUploadInfo({ text: `Transcription returned no text — using AI lyrics`, color: '#ffaa00' })
        }
      }

      const body = { title, artist, genre, language, wolfId: wolf?.id }
      if (bpm)             body.bpm             = bpm
      if (mood)            body.mood            = mood
      if (token)           body.token           = token
      if (transcriptLines) body.transcriptLines = transcriptLines

      const res  = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.error === 'LIMIT_REACHED') { onShowLimitModal(); return }
        throw new Error(json.error || 'Generation failed')
      }
      localStorage.setItem('lw_last_pack', JSON.stringify(json.pack))
      localStorage.setItem('lw_last_meta', JSON.stringify(json.meta))
      if (isLoneWolf) incrementLoneWolfGenCount()
      setPack(json.pack)
      setMeta(json.meta)
    } catch (err) {
      setGenError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  function handleNewTrack() {
    setTitle(''); setBpm(''); setMood('')
    setUploadInfo(null); setUploadedFile(null); setPack(null); setMeta(null); setGenError('')
    localStorage.removeItem('lw_last_pack'); localStorage.removeItem('lw_last_meta')
  }

  function downloadSrt() {
    if (!pack?.srt) return
    downloadText(pack.srt, `${meta?.title || 'lyrics'}.srt`, 'text/plain')
  }

  function exportBeats() {
    if (!pack?.beats) return
    let txt = 'TIMESTAMP\tLABEL\tTYPE\n'
    pack.beats.forEach(b => { txt += `${b.ts}\t${b.label}\t${b.type}\n` })
    downloadText(txt, `${meta?.title || 'beats'}-cuts.txt`, 'text/plain')
  }

  function handleSaveTrack() {
    if (!pack || !meta) return
    const tracks = lsGet(LW_TRACKS_KEY)
    tracks.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: meta.title, artist: meta.artist, genre: meta.genre,
      wolfId: meta.wolfId || wolf?.id, date: new Date().toISOString(),
      pack, meta,
    })
    lsSet(LW_TRACKS_KEY, tracks)
    setSavedMsg('Saved!')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  const planBadge = isLoneWolf ? 'LONE WOLF' : (profile?.role === 'member' ? 'WOLF PACK' : (user ? 'FREE' : 'PUBLIC'))
  const planClass = isLoneWolf ? 'plan-badge lone-wolf' : (profile?.role === 'member' ? 'plan-badge member' : 'plan-badge')

  return (
    <div id="studio-section" className="app-section">
      <div className="studio-body">
        {/* LEFT PANEL */}
        <aside className="left-panel">
          <div className="field-group">
            <label className="field-label">Reference Track</label>
            <div
              className={`upload-zone${dragover ? ' dragover' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragover(true) }}
              onDragLeave={() => setDragover(false)}
              onDrop={e => { e.preventDefault(); setDragover(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            >
              <input ref={fileInputRef} type="file" accept="audio/*,video/*" hidden
                     onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]) }} />
              <div className="upload-icon">🎵</div>
              <div className="upload-text">Drag &amp; drop audio or video</div>
              <div className="upload-sub">or click to browse · max 50MB</div>
              {uploadInfo && (
                <div className="upload-info" style={uploadInfo.color ? { color: uploadInfo.color } : {}}>
                  {uploadInfo.text}
                </div>
              )}
            </div>
          </div>

          <div className="field-group"><label className="field-label">Song Title *</label>
            <input type="text" placeholder="e.g. Midnight Run" value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className="field-group"><label className="field-label">Artist Name *</label>
            <input type="text" placeholder="e.g. Lazy Jo" value={artist} onChange={e => setArtist(e.target.value)} /></div>

          <div className="field-group"><label className="field-label">Genre *</label>
            <select value={genre} onChange={e => setGenre(e.target.value)}>
              <option value="">Select genre…</option>
              {['Melodic Hip-Hop','Hip-Hop','Afrobeats','Trap','Drill','R&B','Pop','French Pop','French Hip-Hop','Dance/EDM','Amapiano','Afro-Trap','Rock','Other'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="field-group"><label className="field-label">BPM <span className="label-optional">(optional)</span></label>
            <input type="number" placeholder="e.g. 140" min="40" max="300" value={bpm} onChange={e => setBpm(e.target.value)} /></div>

          <div className="field-group"><label className="field-label">Language *</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}>
              {['English','French','Spanish','Portuguese','Arabic','Wolof','Other'].map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="field-group"><label className="field-label">Mood / Vibe</label>
            <textarea rows="3" placeholder="e.g. Late night drive, introspective…" value={mood} onChange={e => setMood(e.target.value)}></textarea>
          </div>

          <button className="btn-generate" onClick={handleGenerate} disabled={generating}>
            <span className="btn-lightning">⚡</span>
            <span className="btn-text">{generating ? (uploadedFile ? 'TRANSCRIBING…' : 'GENERATING…') : 'GENERATE'}</span>
          </button>
          {genError && <div className="gen-error">{genError}</div>}
        </aside>

        {/* RIGHT PANEL */}
        <main className="right-panel">
          {meta && (
            <div className="summary-card">
              <img className="summary-wolf" src={`/${wolf?.image || 'logo.svg'}`} alt=""
                   onError={e => e.target.style.display='none'} />
              <div className="summary-info">
                <div className="summary-title">{meta.title}</div>
                <div className="summary-meta">
                  <span>{meta.artist}</span>
                  <span className="summary-genre-badge">{meta.genre}</span>
                </div>
              </div>
              <button className="btn-outline btn-sm" onClick={handleSaveTrack}>{savedMsg || 'Save to Tracks'}</button>
              <button className="btn-outline btn-sm" onClick={handleNewTrack}>New Track</button>
            </div>
          )}

          {generating && (
            <div className="waveform-wrap">
              <div className="waveform-bar-container">
                <span className="generating-label">Generating your pack…</span>
                <div className="waveform">
                  {Array.from({length: 16}).map((_, i) => <div key={i} className="waveform-bar"></div>)}
                </div>
              </div>
            </div>
          )}

          <div className="tabs-wrap">
            <div className="tabs">
              {['lyrics','srt','beats','prompts','tips'].map(t => (
                <button key={t} className={`tab${activeTab===t?' active':''}`} onClick={() => setActiveTab(t)}>
                  {t === 'srt' ? 'SRT' : t === 'beats' ? 'BEAT CUTS' : t === 'prompts' ? 'AI PROMPTS' : t === 'tips' ? 'VIDEO TIPS' : t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="tab-content-wrap">
            {/* LYRICS */}
            {activeTab === 'lyrics' && (
              <div className="tab-panel active">
                {!pack?.lyrics?.length ? (
                  <div className="empty-state"><div className="empty-icon">🎤</div><div>Generate a pack to see timed lyrics here</div></div>
                ) : (
                  <div className="lyrics-list">
                    {pack.lyrics.map((line, i) => {
                      const isHeader = /^\[.+\]$/.test((line.text||'').trim())
                      return isHeader
                        ? <div key={i} className="lyric-section-header">{line.text.replace(/[\[\]]/g,'')}</div>
                        : <div key={i} className="lyric-row"><span className="lyric-ts">{line.ts}</span><span className="lyric-text">{line.text}</span></div>
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SRT */}
            {activeTab === 'srt' && (
              <div className="tab-panel active">
                {!pack?.srt ? (
                  <div className="empty-state"><div className="empty-icon">📄</div><div>SRT subtitle file will appear here</div></div>
                ) : (
                  <div>
                    <div className="srt-actions"><button className="btn-outline btn-sm" onClick={downloadSrt}>⬇ Download .srt</button></div>
                    <pre className="srt-pre">{pack.srt}</pre>
                  </div>
                )}
              </div>
            )}

            {/* BEAT CUTS */}
            {activeTab === 'beats' && (
              <div className="tab-panel active">
                {!pack?.beats?.length ? (
                  <div className="empty-state"><div className="empty-icon">🎬</div><div>Beat cut timestamps will appear here</div></div>
                ) : (
                  <div>
                    <div className="beats-actions"><button className="btn-outline btn-sm" onClick={exportBeats}>⬇ Export .txt</button></div>
                    <table className="beats-table">
                      <thead><tr><th>Timestamp</th><th>Label</th><th>Type</th></tr></thead>
                      <tbody>
                        {pack.beats.map((b, i) => (
                          <tr key={i}>
                            <td className="beat-ts">{b.ts}</td>
                            <td>{b.label}</td>
                            <td><span className={`beat-type-badge beat-type-${b.type||'CUT'}`}>{b.type||'CUT'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* AI PROMPTS */}
            {activeTab === 'prompts' && (
              <div className="tab-panel active">
                {!pack?.prompts?.length ? (
                  <div className="empty-state"><div className="empty-icon">🎥</div><div>AI video prompts for Kling / Runway / PixVerse will appear here</div></div>
                ) : (
                  <div className="prompts-list">
                    {pack.prompts.map((p, i) => (
                      <PromptCard key={i} prompt={p} idx={i} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIDEO TIPS */}
            {activeTab === 'tips' && (
              <div className="tab-panel active">
                {!pack?.tips?.length ? (
                  <div className="empty-state"><div className="empty-icon">💡</div><div>Genre-specific video tips will appear here</div></div>
                ) : (
                  <div className="tips-list">
                    {pack.tips.map((tip, i) => (
                      <div key={i} className="tip-card">
                        <div className="tip-icon">{TIP_ICONS[i % TIP_ICONS.length]}</div>
                        <div><div className="tip-title">{tip.title}</div><div className="tip-text">{tip.tip}</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function PromptCard({ prompt: p }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(p.prompt || '').then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="prompt-card">
      <div className="prompt-section-name">{p.section}</div>
      <div className="prompt-text">{p.prompt}</div>
      <button className="prompt-copy-btn" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button>
    </div>
  )
}

// ─── Tracks Page ─────────────────────────────────────────────────────────────
function TracksPage({ onLoadTrack }) {
  const [tracks, setTracks] = useState(() => lsGet(LW_TRACKS_KEY))

  function handleDelete(id) {
    const next = tracks.filter(t => t.id !== id)
    lsSet(LW_TRACKS_KEY, next)
    setTracks(next)
  }

  return (
    <div className="app-section">
      <div className="section-body">
        <div className="section-hero">
          <div className="section-icon">🎵</div>
          <h2 className="section-title">TRACKS</h2>
          <p className="section-desc">Your saved packs and past generations — all in one place.</p>
        </div>
        {!tracks.length ? (
          <div className="empty-state"><div className="empty-icon">📦</div><div>No saved tracks yet. Generate a pack in the Studio and hit "Save to Tracks".</div></div>
        ) : (
          <div className="tracks-list">
            {tracks.map(track => {
              const dateStr = new Date(track.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              return (
                <div key={track.id} className="track-row">
                  <div className="track-info" onClick={() => onLoadTrack(track)}>
                    <div className="track-title">{track.title}</div>
                    <div className="track-meta">
                      <span>{track.artist}</span>
                      <span className="track-genre-badge">{track.genre}</span>
                      <span className="track-date">{dateStr}</span>
                    </div>
                  </div>
                  <button className="btn-ghost btn-sm track-delete" onClick={() => handleDelete(track.id)} title="Delete">✕</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Gallery Page (shared for Visuals + Covers) ──────────────────────────────
function GalleryPage({ title, icon, desc, emptyText, storageKey, canUpload }) {
  const [items, setItems] = useState(() => lsGet(storageKey))
  const [pendingFiles, setPendingFiles] = useState([])
  const [tagWolf, setTagWolf] = useState('')
  const fileRef = useRef(null)

  function refresh() { setItems(lsGet(storageKey)) }

  function handleFilesSelected(e) {
    setPendingFiles(Array.from(e.target.files))
  }

  function handleUpload() {
    if (!pendingFiles.length) return
    let processed = 0
    pendingFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const all = lsGet(storageKey)
        all.unshift({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: file.name,
          type: file.type.startsWith('video') ? 'video' : 'photo',
          wolf: tagWolf, data: reader.result, date: new Date().toISOString(),
        })
        lsSet(storageKey, all)
        processed++
        if (processed === pendingFiles.length) {
          setPendingFiles([])
          if (fileRef.current) fileRef.current.value = ''
          refresh()
        }
      }
      reader.readAsDataURL(file)
    })
  }

  function handleDelete(id) {
    const next = items.filter(v => v.id !== id)
    lsSet(storageKey, next)
    setItems(next)
  }

  return (
    <div className="app-section">
      <div className="section-body">
        <div className="section-hero">
          <div className="section-icon">{icon}</div>
          <h2 className="section-title">{title}</h2>
          <p className="section-desc">{desc}</p>
        </div>

        {canUpload && (
          <div className="gallery-upload-panel">
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={handleFilesSelected} />
            <div className="gallery-upload-row">
              <button className="btn-outline btn-sm" onClick={() => fileRef.current?.click()}>Choose Files</button>
              <select className="gallery-tag-select" value={tagWolf} onChange={e => setTagWolf(e.target.value)}>
                <option value="">Tag a wolf…</option>
                {WOLF_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button className="btn-gold btn-sm" disabled={!pendingFiles.length} onClick={handleUpload}>Upload</button>
            </div>
            {pendingFiles.length > 0 && (
              <div className="gallery-upload-preview">
                {pendingFiles.map((f, i) => <span key={i} className="gallery-preview-tag">{f.name}</span>)}
              </div>
            )}
          </div>
        )}

        {!items.length ? (
          <div className="empty-state"><div className="empty-icon">🖼️</div><div>{emptyText}</div></div>
        ) : (
          <div className="gallery-grid">
            {items.map(item => (
              <GalleryCard key={item.id} item={item} canDelete={canUpload} onDelete={() => handleDelete(item.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GalleryCard({ item, canDelete, onDelete }) {
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef(null)
  const isVideo = item.type === 'video'

  function togglePlay() {
    if (!videoRef.current) return
    if (videoRef.current.paused) { videoRef.current.play(); setPlaying(true) }
    else { videoRef.current.pause(); setPlaying(false) }
  }

  return (
    <div className="gallery-card">
      <div className="gallery-media-wrap" onClick={isVideo ? togglePlay : undefined}>
        {isVideo
          ? <><video ref={videoRef} className="gallery-media" src={item.data} preload="metadata" muted />
              {!playing && <div className="gallery-play-badge">▶</div>}</>
          : <img className="gallery-media" src={item.data} alt={item.name} loading="lazy" />
        }
      </div>
      <div className="gallery-card-footer">
        {item.wolf && <span className="gallery-wolf-tag">{item.wolf}</span>}
        <span className="gallery-item-name">{item.name}</span>
        {canDelete && <button className="btn-ghost btn-sm gallery-delete" onClick={onDelete} title="Delete">✕</button>}
      </div>
    </div>
  )
}

// ─── The Pack Page ───────────────────────────────────────────────────────────
function ThePackPage() {
  const [collabs, setCollabs]     = useState(() => lsGet(LW_COLLABS_KEY))
  const [showForm, setShowForm]   = useState(false)
  const [projName, setProjName]   = useState('')
  const [checkedWolves, setCheckedWolves] = useState([])

  function toggleWolf(name) {
    setCheckedWolves(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  function handleSave() {
    if (!projName.trim()) return
    const all = lsGet(LW_COLLABS_KEY)
    all.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: projName.trim(), wolves: checkedWolves,
      createdBy: 'Wolf', date: new Date().toISOString(),
    })
    lsSet(LW_COLLABS_KEY, all)
    setCollabs(all)
    setProjName(''); setCheckedWolves([]); setShowForm(false)
  }

  function handleDelete(id) {
    const next = collabs.filter(c => c.id !== id)
    lsSet(LW_COLLABS_KEY, next)
    setCollabs(next)
  }

  return (
    <div className="app-section">
      <div className="section-body">
        <div className="section-hero">
          <div className="section-icon">🐺</div>
          <h2 className="section-title">THE PACK</h2>
          <p className="section-desc">Crew profiles and collabs — the wolves behind the music.</p>
        </div>

        <div className="pack-grid">
          {PACK_MEMBERS.map(m => (
            <div key={m.name} className={`pack-card${m.halfColor ? ' pack-card-half' : ''}`} style={{ '--card-color': m.color, ...(m.halfColor ? {'--card-color-2': m.halfColor} : {}) }}>
              {m.image
                ? <img src={`/${m.image}`} alt={m.name} className="pack-avatar-img" onError={e => e.target.outerHTML='<div class="pack-avatar">🐺</div>'} />
                : <div className="pack-avatar">{m.emoji}</div>
              }
              <div className={`pack-name${m.halfColor ? ' pack-name-half' : ''}`}>{m.name}</div>
              <div className="pack-role">{m.role}</div>
              <div className="pack-tag">{m.tag}</div>
            </div>
          ))}
        </div>

        <div className="collabs-section">
          <div className="collabs-header">
            <h3 className="collabs-title">COLLABS</h3>
            <button className="btn-outline btn-sm" onClick={() => setShowForm(true)}>+ New Collab</button>
          </div>

          {showForm && (
            <div className="collab-form">
              <div className="collab-form-row">
                <input type="text" className="collab-input" placeholder="Project name…" value={projName} onChange={e => setProjName(e.target.value)} />
              </div>
              <div className="collab-form-row">
                <label className="collab-label">Tag wolves:</label>
                <div className="collab-wolf-checks">
                  {WOLF_NAMES.map(n => (
                    <label key={n} className="collab-check">
                      <input type="checkbox" checked={checkedWolves.includes(n)} onChange={() => toggleWolf(n)} /> {n}
                    </label>
                  ))}
                </div>
              </div>
              <div className="collab-form-actions">
                <button className="btn-gold btn-sm" onClick={handleSave}>Save Collab</button>
                <button className="btn-ghost btn-sm" onClick={() => { setShowForm(false); setProjName(''); setCheckedWolves([]) }}>Cancel</button>
              </div>
            </div>
          )}

          {!collabs.length ? (
            <div className="empty-state"><div className="empty-icon">🤝</div><div>No collabs yet — start one and tag your wolves.</div></div>
          ) : (
            <div className="collabs-list">
              {collabs.map(c => {
                const dateStr = new Date(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                return (
                  <div key={c.id} className="collab-row">
                    <div className="collab-info">
                      <div className="collab-project-name">{c.name}</div>
                      <div className="collab-meta">
                        <span className="collab-date">{dateStr}</span>
                        <span className="collab-by">by {c.createdBy}</span>
                      </div>
                      <div className="collab-wolves">
                        {c.wolves.map(w => <span key={w} className="collab-wolf-tag">{w}</span>)}
                      </div>
                    </div>
                    <button className="btn-ghost btn-sm collab-delete" onClick={() => handleDelete(c.id)} title="Delete">✕</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Upgrade Modal ───────────────────────────────────────────────────────────
function UpgradeModal({ onClose, onSignup }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box upgrade-modal-box">
        <div className="modal-icon">🐺</div>
        <h2 className="modal-title">Join the Pack</h2>
        <p className="modal-body">You've used your <strong>3 free generations</strong>.<br/>Upgrade to Wolf Pack for unlimited access.</p>
        <div className="upgrade-price"><span className="upgrade-amount">$9</span><span className="upgrade-period">/month</span></div>
        <ul className="upgrade-perks">
          <li>Unlimited generations</li>
          <li>Save &amp; manage your Tracks</li>
          <li>Access Visuals, Covers &amp; The Pack</li>
          <li>Earn 40% revenue on referrals</li>
        </ul>
        <div className="modal-actions">
          <button className="btn-gold btn-full" onClick={onSignup}>JOIN THE PACK</button>
          <button className="btn-ghost" onClick={onClose}>Not Now</button>
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function DashboardPage({ wolf, profile, token, onBack, onSignOut }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/dashboard', { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (res.ok) setStats(json.stats)
      } catch { /* offline */ }
    }
    load()
  }, [token])

  return (
    <div id="dashboard-page" className="page">
      <header className="studio-header">
        <div className="studio-header-left">
          <img src="/logo.svg" alt="LW" className="studio-logo" onError={e => e.target.style.display='none'} />
          <div className="studio-titles"><div className="studio-brand">LIGHTNING WOLVES / Member Dashboard</div></div>
        </div>
        <div className="studio-header-right">
          <button className="btn-outline" onClick={onBack}>← Studio</button>
          <button className="btn-ghost" onClick={onSignOut}>Sign Out</button>
        </div>
      </header>

      <div className="dashboard-body">
        <div className="dash-wolf-hero">
          <img src={wolf?.image ? `/${wolf.image}` : '/logo.svg'} alt="" onError={e => e.target.style.display='none'} />
          <div className="dash-wolf-name">{profile?.display_name || wolf?.artist || ''}</div>
          <div className="dash-badge">Wolf Pack Member</div>
        </div>

        <div className="dash-grid">
          <div className="dash-card"><div className="dash-card-label">Referrals This Month</div><div className="dash-card-value">{stats?.referralCount ?? '—'}</div></div>
          <div className="dash-card"><div className="dash-card-label">Packs by Referred Users</div><div className="dash-card-value">{stats?.referredGenerations ?? '—'}</div></div>
          <div className="dash-card"><div className="dash-card-label">Your Packs Generated</div><div className="dash-card-value">{stats?.ownGenerations ?? '—'}</div></div>
          <div className="dash-card dash-earnings">
            <div className="dash-card-label">Est. Earnings</div>
            <div className="dash-card-value gold">{stats ? `$${stats.earningsEstimate}` : '$—'}</div>
            <div className="dash-card-sub">Revenue split: Owner 50% · Members 40% · Costs 10%</div>
          </div>
        </div>

        <div className="promo-section">
          <div className="promo-label">Your Promo Code</div>
          <div className="promo-code-display">{profile?.promo_code || ''}</div>
          <div className="promo-copy-hint">Share this code with your fans to track referrals</div>
        </div>
      </div>
    </div>
  )
}

// ─── Limit Modal ──────────────────────────────────────────────────────────────
function LimitModal({ onClose, onSignup }) {
  return (
    <div id="limit-modal" className="modal-overlay">
      <div className="modal-box">
        <div className="modal-icon">⚡</div>
        <h2 className="modal-title">You've Hit Your Limit</h2>
        <p className="modal-body">Free accounts get 3 generations/month.<br/>Sign up or sign in to get unlimited access as a Wolf Pack member.</p>
        <div className="modal-actions">
          <button className="btn-gold" onClick={onSignup}>Join the Pack</button>
          <button className="btn-ghost" onClick={onClose}>Not Now</button>
        </div>
      </div>
    </div>
  )
}

// ─── Nav Bar ─────────────────────────────────────────────────────────────────
function NavBar({ section, onNavigate, isMember }) {
  const sections = [
    { id: 'studio', label: 'Studio', membersOnly: false },
    { id: 'tracks', label: 'Tracks', membersOnly: true },
    { id: 'visuals', label: 'Visuals', membersOnly: true },
    { id: 'covers', label: 'Covers', membersOnly: true },
    { id: 'the-pack', label: 'The Pack', membersOnly: true },
  ]
  return (
    <nav className="main-nav">
      {sections.map(s => (
        (!s.membersOnly || isMember) && (
          <button key={s.id} className={`nav-link${section === s.id ? ' active' : ''}`} onClick={() => onNavigate(s.id)}>
            {s.label}
          </button>
        )
      ))}
    </nav>
  )
}

// ─── App Shell (header + nav + section content) ──────────────────────────────
function AppShell({ wolf, user, profile, token, supabase, section, onNavigate, onChangeWolf, onShowAuth, onSignOut, onOpenDashboard, onShowLimitModal, onShowUpgradeModal, testMemberMode, onToggleTestMember }) {
  const realMember = profile?.role === 'member'
  const isMember = realMember || testMemberMode
  const isLoneWolf = !user && wolf?.id === 'lone-wolf'
  const planBadge = testMemberMode ? 'MEMBER (TEST)' : (isLoneWolf ? 'LONE WOLF' : (realMember ? 'WOLF PACK' : (user ? 'FREE' : 'PUBLIC')))
  const planClass = testMemberMode ? 'plan-badge member' : (isLoneWolf ? 'plan-badge lone-wolf' : (realMember ? 'plan-badge member' : 'plan-badge'))

  const displayName = (profile?.display_name || '').toLowerCase()
  const wolfArtist = (wolf?.artist || '').toLowerCase()
  const canUploadVisuals = displayName === 'shiteux' || displayName === 'lazy jo' || wolfArtist === 'lazy jo'
  const canUploadCovers  = displayName === 'drippydesigns' || displayName === 'lazy jo' || wolfArtist === 'lazy jo'

  const [studioKey, setStudioKey] = useState(0)

  function handleLoadTrack(track) {
    localStorage.setItem('lw_last_pack', JSON.stringify(track.pack))
    localStorage.setItem('lw_last_meta', JSON.stringify(track.meta))
    setStudioKey(k => k + 1)
    onNavigate('studio')
  }

  return (
    <div id="app-shell" className="page">
      <header className="studio-header">
        <div className="studio-header-left">
          <img src="/logo.png" alt="Lightning Wolves" className="studio-logo" onError={e => e.target.style.display='none'} />
          <div className="studio-titles"><div className="studio-brand">LIGHTNING WOLVES</div></div>
        </div>
        <div className="studio-header-right">
          <span className="artist-dot" style={{ background: wolf?.color, boxShadow: `0 0 8px ${wolf?.color}` }}></span>
          <span className="artist-name-header">{wolf?.artist || ''}</span>
          <span className={planClass}>{planBadge}</span>
          <button className={`btn-test-member${testMemberMode ? ' active' : ''}`} onClick={onToggleTestMember}>
            {testMemberMode ? '✓ Member Mode' : 'Member Mode'}
          </button>
          <button className="btn-outline" onClick={onChangeWolf}>Change Wolf</button>
          {user ? (
            <>
              {isMember && <button className="btn-ghost" onClick={onOpenDashboard}>Dashboard</button>}
              <button className="btn-ghost" onClick={onSignOut}>Sign Out</button>
            </>
          ) : (
            <button className="btn-ghost" onClick={onShowAuth}>Sign In</button>
          )}
        </div>
      </header>

      <NavBar section={section} onNavigate={onNavigate} isMember={isMember} />

      {section === 'studio' && (
        <StudioPage key={studioKey} wolf={wolf} user={user} profile={profile} token={token} supabase={supabase}
          onChangeWolf={onChangeWolf} onShowAuth={onShowAuth} onSignOut={onSignOut}
          onOpenDashboard={onOpenDashboard} onShowLimitModal={onShowLimitModal} onShowUpgradeModal={onShowUpgradeModal} />
      )}
      {section === 'tracks' && <TracksPage onLoadTrack={handleLoadTrack} />}
      {section === 'visuals' && (
        <GalleryPage title="VISUALS" icon="📸"
          desc="Photo & video gallery for the pack. Shiteux and Lazy Jo can upload — everyone can view."
          emptyText="No visuals yet — Shiteux will upload soon 👀"
          storageKey={LW_VISUALS_KEY} canUpload={canUploadVisuals && isMember} />
      )}
      {section === 'covers' && (
        <GalleryPage title="COVERS" icon="🎨"
          desc="Artwork & trailers gallery. Drippydesigns and Lazy Jo can upload — everyone can view."
          emptyText="No covers yet — Drippydesigns is cooking 🎨"
          storageKey={LW_COVERS_KEY} canUpload={canUploadCovers && isMember} />
      )}
      {section === 'the-pack' && <ThePackPage />}
    </div>
  )
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page,             setPage]             = useState('wolf-select')
  const [section,          setSection]          = useState('studio')
  const [wolf,             setWolf]             = useState(null)
  const [user,             setUser]             = useState(null)
  const [profile,          setProfile]          = useState(null)
  const [token,            setToken]            = useState(null)
  const [supabase,         setSupabase]         = useState(null)
  const [showLimitModal,   setShowLimitModal]   = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [testMemberMode,   setTestMemberMode]   = useState(false)

  // Apply wolf theme CSS variables
  useEffect(() => {
    const color = wolf?.color || '#f5c518'
    document.documentElement.style.setProperty('--wolf-color', color)
    document.documentElement.style.setProperty('--accent', color)
  }, [wolf])

  // Init Supabase + restore session
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/config')
        if (!res.ok) return
        const cfg = await res.json()
        if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return
        const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
        setSupabase(sb)

        const { data } = await sb.auth.getSession()
        if (data.session) {
          setUser(data.session.user)
          setToken(data.session.access_token)
          await fetchProfile(sb, data.session.user.id)
        }

        sb.auth.onAuthStateChange(async (_event, session) => {
          if (session) {
            setUser(session.user)
            setToken(session.access_token)
            await fetchProfile(sb, session.user.id)
          } else {
            setUser(null); setToken(null); setProfile(null)
          }
        })
      } catch {
        console.info('Supabase not configured, running in guest mode')
      }
    }
    init()
  }, [])

  async function fetchProfile(sb, userId) {
    const { data } = await sb.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
  }

  function handleSelectWolf(w) {
    setWolf(w)
    setSection('studio')
    setPage('app')
  }

  function handleAuth(authUser, authToken) {
    setUser(authUser)
    setToken(authToken)
    if (authUser && supabase) fetchProfile(supabase, authUser.id)
    setPage(wolf ? 'app' : 'wolf-select')
  }

  async function handleSignOut() {
    if (supabase) await supabase.auth.signOut()
    setUser(null); setToken(null); setProfile(null)
    setSection('studio')
    setPage('wolf-select')
  }

  function handleNavigate(s) {
    const effectiveMember = profile?.role === 'member' || testMemberMode
    if (s !== 'studio' && !effectiveMember) { setSection('studio'); return }
    setSection(s)
  }

  return (
    <>
      <LightningCanvas wolfColor={wolf?.color || '#f5c518'} />

      {page === 'wolf-select' && (
        <WolfSelectPage onSelectWolf={handleSelectWolf} />
      )}

      {page === 'auth' && (
        <AuthPage supabase={supabase} onAuth={handleAuth} onGuest={() => setPage('wolf-select')} />
      )}

      {page === 'app' && (
        <AppShell
          wolf={wolf} user={user} profile={profile} token={token} supabase={supabase}
          section={section} onNavigate={handleNavigate}
          testMemberMode={testMemberMode} onToggleTestMember={() => setTestMemberMode(m => !m)}
          onChangeWolf={() => { setSection('studio'); setPage('wolf-select') }}
          onShowAuth={() => setPage('auth')}
          onSignOut={handleSignOut}
          onOpenDashboard={() => setPage('dashboard')}
          onShowLimitModal={() => setShowLimitModal(true)}
          onShowUpgradeModal={() => setShowUpgradeModal(true)}
        />
      )}

      {page === 'dashboard' && (
        <DashboardPage wolf={wolf} profile={profile} token={token}
          onBack={() => setPage('app')} onSignOut={handleSignOut} />
      )}

      {showLimitModal && (
        <LimitModal onClose={() => setShowLimitModal(false)}
          onSignup={() => { setShowLimitModal(false); setPage('auth') }} />
      )}

      {showUpgradeModal && (
        <UpgradeModal onClose={() => setShowUpgradeModal(false)}
          onSignup={() => { setShowUpgradeModal(false); setPage('auth') }} />
      )}
    </>
  )
}
