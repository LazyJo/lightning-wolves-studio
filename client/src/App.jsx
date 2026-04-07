import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

// ─── Wolf data ────────────────────────────────────────────────────────────────
const WOLVES = [
  // Row 1 — Active wolves with animations
  { id: 'yellow', color: '#f5c518', artist: 'Lazy Jo',       genre: 'Melodic Hip-Hop',     image: 'LightningWolfYellowTransparentBG.png', video: '/LazyJoWolfAnimation.mp4', locked: false },
  { id: 'purple', color: '#9b6dff', artist: 'Zirka',         genre: 'French Hip-Hop',      image: 'LightningWolfPurpleTransparentBG.png', video: '/Wolf-Purple.mp4', locked: false },
  { id: 'orange', color: '#ff9500', artist: 'Rosakay',       genre: 'Pop / French Pop',    image: 'LightningWolfOrangeTransparentBG.png', video: '/RosakayWolfAnimation.mp4', locked: false },
  // Row 2 — Active + Lone Wolf
  { id: 'blue',   color: '#82b1ff', artist: 'Drippydesigns', genre: 'Covers & Trailers',   image: 'LightningWolfGreenTransparentBG.png', video: '/wolf-white-blue.mp4', locked: false },
  { id: 'lone',   color: '#f5c518', artist: 'Lone Wolf',     genre: '3 Free Generations',  image: 'LightningWolvesLogoTransparentBG.png', locked: false, isLoneWolf: true, emoji: '🐺' },
  { id: 'green',  color: '#69f0ae', artist: 'Shiteux',       genre: 'Photos & Videos',     image: 'LightningWolfGreenTransparentBG.png', video: '/Wolf-Green.mp4', locked: false },
  // Row 3 — Coming Soon with animations
  { id: 'red',    color: '#E53935', artist: 'Hendrik Vits',  genre: 'Coming Soon',         image: 'WolfRed.png', video: '/WolfRed.mp4', locked: true, comingSoon: true },
  { id: 'white',  color: '#e8e8e8', artist: 'MMJ',           genre: 'Coming Soon',         image: 'WhiteWolf.png', video: '/WhiteWolfAnimation.mp4', locked: true, comingSoon: true },
  { id: 'pink',   color: '#E040FB', artist: 'Soon Available', genre: 'Coming Soon',        image: 'PinkWolf.png', video: '/PinkWolfAnimation.mp4', locked: true, comingSoon: true },
  // Row 4 — Locked ??? + Join the Pack in middle
  { id: 'lock1',  color: '#333333', artist: '???',           genre: 'Coming Soon',         image: 'wolf-black.svg', locked: true },
  { id: 'join',   color: '#f5c518', artist: 'Join the Pack', genre: 'Apply to Join',       image: 'LightningWolvesLogoTransparentBG.png', locked: false, isJoinCard: true },
  { id: 'lock2',  color: '#333333', artist: '???',           genre: 'Coming Soon',         image: 'wolf-black.svg', locked: true },
]

const TIP_ICONS = ['📱', '🎬', '▶️', '🎨', '🔊', '💡', '🌟', '🎯']

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
        <img src="/LightningWolvesLogoTransparentBG.png" alt="Lightning Wolves" className="auth-logo" onError={e => e.target.style.display='none'} />
        <div className="auth-wordmark">LIGHTNING WOLVES</div>
        <div className="auth-sub">LYRICS STUDIO</div>

        <div className="auth-tabs">
          <button className={`auth-tab${tab==='login'?' active':''}`} onClick={() => setTab('login')}>SIGN IN</button>
          <button className={`auth-tab${tab==='signup'?' active':''}`} onClick={() => setTab('signup')}>SIGN UP</button>
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

// ─── Wolf Profile Data ────────────────────────────────────────────────────────
const WOLF_PROFILES = {
  yellow: {
    name: 'Lazy Jo', role: 'Founder · Artist', genre: 'Melodic Hip-Hop', color: '#f5c518',
    image: 'LightningWolfYellowTransparentBG.png',
    animation: 'LazyJoWolfAnimation.mp4',
    bookUrl: 'https://www.gigstarter.be/artists/lazy-jo',
    flipBio: 'Belgian-Ghanaian artist from Brussels. Melodic flows, emotional hooks, unforgettable sound. Debut in 2018 — co-signed by Timbaland, Symba, DDG & More. 100K views and still rising.',
    bio: `Lazy Jo is a Belgian artist with Ghanaian roots, born in 1999 in Lomé, Togo and based in Brussels, Belgium. Immersed in music from an early age, he began shaping his sound at a young age and officially launched his career in February 2018 with his debut single "I'm Lost." Known for his distinctive melodic flows, emotionally driven delivery, and unforgettable hooks, Lazy Jo creates music that lingers long after the first listen. His ability to craft catchy, memorable melodies has become a defining element of his artistry, setting him apart in a crowded music landscape. Driven by consistency and growth, Lazy Jo continues to evolve his sound while building a strong and authentic artistic presence. His dedication has not gone unnoticed — industry heavyweights such as Kelvyn Colt, Zaytoven, DDG, and Timbaland have recognized and supported his talent. Most recently, Lazy Jo reached a major milestone with his track "Stay Up," which surpassed 100,000 views, further cementing his rising influence and momentum within the music scene.`,
    spotifyEmbed: 'https://open.spotify.com/embed/artist/1gxwDVgOKYnTA3iq2CjLtM?utm_source=generator&theme=0',
    performanceVideo: 'LazyJoPerformanceVideo.mp4',
    merchUrl: 'https://www.even.biz/l/lightningwolves',
    fanUrl: 'https://www.even.biz/l/lazyjomusic',
    email: 'Lazyjo.official@gmail.com',
    youtube: 'https://youtube.com/@lightningwolves',
    instagram: 'https://instagram.com/lazyjoo_',
    spotify: 'https://open.spotify.com/artist/1gxwDVgOKYnTA3iq2CjLtM',
    profilePhoto: 'LazyJoPhoto.jpeg',
    acknowledgements: [
      { name: 'Timbaland', image: 'Timbaland.jpeg', quote: '"This could be the best song"', link: 'https://www.youtube.com/watch?v=timbaland_lazyjo', linkLabel: 'Watch on YouTube' },
      { name: 'Symba', image: 'Symba.jpeg', quote: '"International as a M*****f*****r"', link: 'https://www.youtube.com/watch?v=symba_lazyjo', linkLabel: 'Watch on YouTube' },
      { name: 'DDG', image: 'DDG.jpeg', quote: '"Next Up"', link: 'https://www.instagram.com/p/ddg_lazyjo', linkLabel: 'Watch on Instagram', sublabel: 'On IG' },
      { name: 'Kelvyn Colt', image: 'KelvynColt.jpeg', quote: '"Lightning"', link: 'https://www.youtube.com/watch?v=kelvyncolt_lazyjo', linkLabel: 'Watch on YouTube' },
      { name: 'Zaytoven', image: 'Zaytoven.jpeg', quote: '"Keep going"', link: 'https://www.youtube.com/watch?v=zaytoven_lazyjo', linkLabel: 'Watch on YouTube' },
      { name: 'Kid Hazel', image: 'KidHazel.jpeg', quote: '"Fire"', link: 'https://www.youtube.com/watch?v=kidhazel_lazyjo', linkLabel: 'Watch on YouTube' },
    ]
  },
  purple: {
    name: 'Zirka', role: 'Artist', genre: 'French Hip-Hop', color: '#9b6dff',
    image: 'LightningWolfPurpleTransparentBG.png',
    animation: 'Wolf-Purple.mp4',
    bio: 'French hip-hop energy with melodic punch. Zirka brings raw energy and authentic flow from the streets of France to the Lightning Wolves pack.',
    spotify: 'https://open.spotify.com/artist/1OqzWGPZDe0jUkwS5ubUbF',
    spotifyEmbed: 'https://open.spotify.com/embed/artist/1OqzWGPZDe0jUkwS5ubUbF?utm_source=generator&theme=0',
    merchUrl: 'https://www.even.biz/l/lightningwolves',
    acknowledgements: []
  },
  orange: {
    name: 'Rosakay', role: 'Artiste', genre: 'Pop / French Pop', color: '#ff9500',
    image: 'LightningWolfOrangeTransparentBG.png',
    animation: 'RosakayWolfAnimation.mp4',
    lang: 'fr',
    flipBio: 'Née à Kinshasa, élevée entre Kigali et la Belgique, Rosakay mêle folk rock, pop, R&B et variété française dans un univers intime et sincère. Sa voix, son émotion, son authenticité.',
    bio: `Rosakay est une jeune chanteuse née à Kinshasa, en République Démocratique du Congo, d'origine rwandaise et congolaise. Peu après sa naissance, elle part vivre à Kigali, au Rwanda, où elle grandit jusqu'à l'âge de 11 ans. Elle s'installe ensuite en Belgique, un tournant décisif dans son parcours artistique.\n\nC'est là qu'elle découvre la musique plus profondément. Elle commence par la guitare, avant de laisser sa voix prendre naturellement sa place. À cette période, le groupe Mumford & Sons l'inspire particulièrement. À l'origine, elle ne voulait faire que de la guitare, mais un jour, presque instinctivement, elle décide de chanter - et ne s'arrêtera plus.\n\nRosakay, c'est une voix, de l'émotion et de l'authenticité.\n\nPortée par des influences allant du folk rock à la pop rock, en passant par le R&B et la variété française, elle développe un univers musical sensible et personnel.\n\nL'amour, sous toutes ses formes, devient sa principale source d'inspiration, qu'elle explore à travers des chansons sincères et intimes.`,
    instagram: 'https://www.instagram.com/rosakay_officiel',
    spotify: 'https://open.spotify.com/artist/5DaB9HZOXF1kOqxLiS2d4B',
    spotifyEmbed: 'https://open.spotify.com/embed/artist/5DaB9HZOXF1kOqxLiS2d4B?utm_source=generator&theme=0',
    profilePhoto: 'RosakayProfile.jpeg',
    merchUrl: 'https://www.even.biz/l/lightningwolves',
    acknowledgements: []
  },
  blue: {
    name: 'Drippydesigns', role: 'Designer', genre: 'Visual Art', color: '#82b1ff',
    image: 'LightningWolfGreenTransparentBG.png',
    animation: 'wolf-white-blue.mp4',
    bio: 'The visual identity behind the pack. Drippydesigns crafts the aesthetic world of Lightning Wolves — from logos to merch to the digital presence.',
    merchUrl: 'https://www.even.biz/l/lightningwolves',
    acknowledgements: []
  },
  green: {
    name: 'Shiteux', role: 'Visuals', genre: 'Photo · Video · Beats', color: '#69f0ae',
    image: 'LightningWolfGreenTransparentBG.png',
    animation: 'Wolf-Green.mp4',
    bio: `Every pack needs someone watching. Pierre Van der Heyde — Shiteux — is the one behind the camera and behind the beat. Born in Belgium in 1997, he documents the Lightning Wolves world through photos, video, and sound. From lo-fi meditations 'Sin[e]' and 'Doubt Clouds' to his evolving chillout project Behind this Luck, Shiteux moves quietly and creates loudly.`,
    spotify: 'https://open.spotify.com/artist/4Uagbm0Dkl6hpM96LEYCo9',
    spotifyEmbed: 'https://open.spotify.com/embed/artist/4Uagbm0Dkl6hpM96LEYCo9?utm_source=generator&theme=0',
    merchUrl: 'https://www.even.biz/l/lightningwolves',
    acknowledgements: []
  },
}

// ─── Wolf Profile Page ────────────────────────────────────────────────────────
function WolfProfilePage({ wolf, onBack, onEnterStudio }) {
  const [flipped, setFlipped] = useState(false)
  const profile = WOLF_PROFILES[wolf.id] || {}
  const color = profile.color || wolf.color || '#f5c518'
  const name = profile.name || wolf.artist || ''
  const canvasRef = useRef(null)

  // Gold particle background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let W, H, particles = [], rafId
    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = canvas.parentElement?.scrollHeight || window.innerHeight * 3; }
    resize(); window.addEventListener('resize', resize)
    // Parse wolf color to RGB for particles
    const hexToRgb = (hex) => { const r = parseInt(hex.slice(1,3),16); const g = parseInt(hex.slice(3,5),16); const b = parseInt(hex.slice(5,7),16); return `${r},${g},${b}`; }
    const pColor = hexToRgb(color)
    for (let i = 0; i < 120; i++) particles.push({ x: Math.random()*W, y: Math.random()*H, s: Math.random()*2+2, dx: (Math.random()-0.5)*0.3, dy: -(Math.random()*0.4+0.1), a: Math.random()*0.4+0.5 })
    function draw() {
      ctx.clearRect(0,0,W,H)
      particles.forEach(p => { p.x+=p.dx; p.y+=p.dy; if(p.y<-10){p.y=H+10;p.x=Math.random()*W} if(p.x<0)p.x=W; if(p.x>W)p.x=0; ctx.beginPath(); ctx.arc(p.x,p.y,p.s,0,Math.PI*2); ctx.fillStyle=`rgba(${pColor},${p.a})`; ctx.fill() })
      rafId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize) }
  }, [])

  // French labels for Rosakay
  const isFr = profile.lang === 'fr'
  const L = {
    about: isFr ? 'À PROPOS' : 'ABOUT',
    acks: isFr ? 'RECONNAISSANCES' : 'INDUSTRY ACKNOWLEDGEMENTS',
    music: isFr ? 'MUSIQUE' : 'MUSIC',
    perf: isFr ? 'PERFORMANCE LIVE' : 'LIVE PERFORMANCE',
    book: isFr ? 'Réserver' : 'Book',
    photos: isFr ? 'PHOTOS' : 'PHOTOS',
    support: isFr ? 'SOUTIEN' : 'SUPPORT',
    contact: isFr ? 'CONTACT' : 'CONTACT',
    enterStudio: isFr ? 'ENTRER EN STUDIO COMME' : 'ENTER STUDIO AS',
    tapFlip: isFr ? '↻ APPUYEZ POUR TOURNER' : '↻ TAP TO FLIP',
    tapFlipBack: isFr ? '↻ APPUYEZ POUR REVENIR' : '↻ TAP TO FLIP BACK',
    noPhotos: isFr ? 'Pas encore de photos.' : 'No photos yet.',
    merch: 'LIGHTNING WOLVES MERCH',
    fans: 'TRUE FANS BUY THE ART',
  }

  return (
    <div className="wolf-profile-page" style={{'--wp': color}}>
      <canvas ref={canvasRef} className="wp-particles" />
      {/* Top bar */}
      <div className="wp-topbar">
        <button className="wp-back-btn" onClick={onBack}>← Back</button>
        <div className="wp-topbar-right">
          {profile.bookUrl && (
            <a href={profile.bookUrl} target="_blank" rel="noopener noreferrer" className="wp-book-btn">
              Book {name}
            </a>
          )}
          <button className="wp-enter-btn" onClick={() => onEnterStudio(wolf)}>
            {L.enterStudio} {name.toUpperCase()}
          </button>
        </div>
      </div>

      {/* Wolf name */}
      <h1 className="wp-hero-name">{name}</h1>

      {/* Flip card — shows animation video if available */}
      <div className="wp-flip-container" onClick={() => setFlipped(!flipped)}>
        <div className={`wp-flip-card ${flipped ? 'wp-flipped' : ''}`}>
          <div className="wp-card-front">
            <div className="wp-card-image-wrap">
              {profile.animation ? (
                <video src={`/${profile.animation}`} autoPlay loop muted playsInline preload="auto"
                  ref={el => { if(el) el.play().catch(()=>{}) }}
                  onLoadedData={e => e.target.play().catch(()=>{})}
                  style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}} />
              ) : (
                <img src={`/${profile.image || wolf.image}`} alt={name} />
              )}
            </div>
            <div className="wp-card-overlay">
              <div className="wp-card-overlay-name">{name}</div>
              <div className="wp-card-overlay-genre">{profile.genre || wolf.genre}</div>
              <div className="wp-card-overlay-role">{profile.role}</div>
              <div className="wp-card-flip-hint">{L.tapFlip}</div>
            </div>
          </div>
          <div className="wp-card-back">
            {profile.profilePhoto && (
              <div className="wp-card-back-photo">
                <img src={`/${profile.profilePhoto}`} alt={name} />
              </div>
            )}
            <h3 className="wp-card-back-name">{name}</h3>
            <div className="wp-card-back-genre">{profile.genre}</div>
            <p className="wp-card-back-bio">{profile.flipBio || (profile.bio || '').substring(0, 200) + '...'}</p>
            <div className="wp-card-overlay-role">{profile.role}</div>
            <div className="wp-card-flip-hint">{L.tapFlipBack}</div>
          </div>
        </div>
      </div>

      {/* About */}
      {profile.bio && (
        <div className="wp-section">
          <h2 className="wp-section-title">{L.about}</h2>
          <div className="wp-section-divider"></div>
          <p className="wp-about-text">{profile.bio}</p>
        </div>
      )}

      {/* Industry Acknowledgements — horizontal scroll */}
      {profile.acknowledgements && profile.acknowledgements.length > 0 && (
        <div className="wp-section">
          <h2 className="wp-section-title">{L.acks}</h2>
          <div className="wp-section-divider"></div>
          <div className="wp-acks-scroll-wrap">
            <button className="wp-acks-arrow wp-acks-left" onClick={e => { e.stopPropagation(); const s = e.target.closest('.wp-acks-scroll-wrap').querySelector('.wp-acks-row'); s.scrollBy({left:-220,behavior:'smooth'}); }}>‹</button>
            <div className="wp-acks-row">
              {profile.acknowledgements.map((ack, i) => (
                <div key={i} className="wp-ack-card">
                  <div className="wp-ack-img-wrap">
                    <img src={`/${ack.image}`} alt={ack.name} />
                  </div>
                  <div className="wp-ack-name">{ack.name}</div>
                  <div className="wp-ack-quote">{ack.quote}</div>
                  {ack.sublabel && <div className="wp-ack-sublabel">{ack.sublabel}</div>}
                  <a href={ack.link} target="_blank" rel="noopener noreferrer" className="wp-ack-link">{ack.linkLabel}</a>
                </div>
              ))}
            </div>
            <button className="wp-acks-arrow wp-acks-right" onClick={e => { e.stopPropagation(); const s = e.target.closest('.wp-acks-scroll-wrap').querySelector('.wp-acks-row'); s.scrollBy({left:220,behavior:'smooth'}); }}>›</button>
          </div>
        </div>
      )}

      {/* Music — Spotify embed */}
      {profile.spotifyEmbed && (
        <div className="wp-section">
          <h2 className="wp-section-title">{L.music}</h2>
          <div className="wp-section-divider"></div>
          <div className="wp-spotify-embed">
            <iframe src={profile.spotifyEmbed} width="100%" height="352" frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy" style={{borderRadius: '12px', marginTop: '16px'}} title="Spotify" />
          </div>
        </div>
      )}

      {/* Live Performance */}
      {profile.performanceVideo && (
        <div className="wp-section">
          <div className="wp-perf-header">
            <h2 className="wp-section-title">{L.perf}</h2>
            {profile.bookUrl && (
              <a href={profile.bookUrl} target="_blank" rel="noopener noreferrer" className="wp-book-btn-sm">
                {L.book.toUpperCase()} {name.toUpperCase()}
              </a>
            )}
          </div>
          <div className="wp-section-divider"></div>
          <video src={`/${profile.performanceVideo}`} controls className="wp-perf-video" />
        </div>
      )}

      {/* Photos */}
      <div className="wp-section">
        <h2 className="wp-section-title">{L.photos}</h2>
        <div className="wp-section-divider"></div>
        <div className="wp-photos-empty">
          <span>📷</span>
          <p>{L.noPhotos}</p>
        </div>
      </div>

      {/* Support — Merch + Fan links */}
      <div className="wp-section">
        <h2 className="wp-section-title">{L.support}</h2>
        <div className="wp-section-divider"></div>
        <div className="wp-support-grid">
          {profile.merchUrl ? (
            <a href={profile.merchUrl} target="_blank" rel="noopener noreferrer" className="wp-support-card">
              <img src="/LightningWolvesLogoTransparentBG.png" alt="Merch" className="wp-support-img" />
              <div className="wp-support-label">LIGHTNING WOLVES MERCH</div>
            </a>
          ) : (
            <div className="wp-support-card">
              <img src="/LightningWolvesLogoTransparentBG.png" alt="Merch" className="wp-support-img" />
              <div className="wp-support-label">LIGHTNING WOLVES MERCH</div>
            </div>
          )}
          {profile.fanUrl && (
            <a href={profile.fanUrl} target="_blank" rel="noopener noreferrer" className="wp-support-card">
              <img src="/TrueFans.jpeg" alt="True Fans Buy The Art" className="wp-support-img" style={{borderRadius:'8px'}} />
              <div className="wp-support-label">TRUE FANS BUY THE ART</div>
            </a>
          )}
        </div>
      </div>

      {/* Contact */}
      <div className="wp-section">
        <h2 className="wp-section-title">{L.contact}</h2>
        <div className="wp-section-divider"></div>
        <div className="wp-contact-list">
          {profile.email && <div className="wp-contact-row"><span>✉️</span> {profile.email}</div>}
          {profile.youtube && <a href={profile.youtube} target="_blank" rel="noopener noreferrer" className="wp-contact-row"><span>▶️</span> YouTube</a>}
          {profile.instagram && <a href={profile.instagram} target="_blank" rel="noopener noreferrer" className="wp-contact-row"><span>📸</span> Instagram</a>}
          {profile.spotify && <a href={profile.spotify} target="_blank" rel="noopener noreferrer" className="wp-contact-row"><span>🎵</span> Spotify</a>}
        </div>
      </div>

      {/* Big Enter Studio button at bottom */}
      <div className="wp-bottom-cta">
        <button className="wp-bottom-enter" onClick={() => onEnterStudio(wolf)}>
          {L.enterStudio} {name.toUpperCase()} ⚡
        </button>
      </div>
    </div>
  )
}

// ─── Wolf Select Page ─────────────────────────────────────────────────────────
// ─── Join the Pack Page ───────────────────────────────────────────────────────
// ─── Pricing Page ─────────────────────────────────────────────────────────────
const PROMO_CODES = {
  'WOLFPACK': { type:'percent', value:20, label:'20% off' },
  'LAZYJO':   { type:'percent', value:100, label:'Free month' },
  'STUDIO10': { type:'percent', value:10, label:'10% off' },
  'CREDITS50':{ type:'credits', value:50, label:'+50 bonus Credits ⚡' },
}

function PricingPage({ onBack }) {
  const [billing, setBilling] = useState('monthly')
  const [promo, setPromo] = useState('')
  const [promoResult, setPromoResult] = useState(null)
  const [appliedDiscount, setAppliedDiscount] = useState(0)
  const [tasks, setTasks] = useState(() => JSON.parse(localStorage.getItem('lw_completed_tasks') || '[]'))
  const [credits, setCredits] = useState(() => parseInt(localStorage.getItem('lw_credits') || '0'))
  const [refCount] = useState(() => parseInt(localStorage.getItem('lw_referral_count') || '0'))
  const [countdowns, setCountdowns] = useState({})
  const canvasRef = useRef(null)

  // Particles
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); let W,H,particles=[],rafId
    function resize(){W=canvas.width=window.innerWidth;H=canvas.height=document.body.scrollHeight||window.innerHeight*5}
    resize();window.addEventListener('resize',resize)
    for(let i=0;i<80;i++)particles.push({x:Math.random()*W,y:Math.random()*H,s:Math.random()*2+1,dx:(Math.random()-0.5)*0.3,dy:-(Math.random()*0.3+0.1),a:Math.random()*0.4+0.3})
    function draw(){ctx.clearRect(0,0,W,H);particles.forEach(p=>{p.x+=p.dx;p.y+=p.dy;if(p.y<-10){p.y=H+10;p.x=Math.random()*W}if(p.x<0)p.x=W;if(p.x>W)p.x=0;ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,Math.PI*2);ctx.fillStyle=`rgba(245,197,24,${p.a})`;ctx.fill()});rafId=requestAnimationFrame(draw)}
    draw();return()=>{cancelAnimationFrame(rafId);window.removeEventListener('resize',resize)}
  },[])

  const applyPromo = () => {
    const code = promo.toUpperCase().trim()
    const p = PROMO_CODES[code]
    if (p) {
      setPromoResult({ success: true, label: p.label })
      localStorage.setItem('lw_promo_code', code)
      if (p.type === 'percent') setAppliedDiscount(p.value)
      if (p.type === 'credits') {
        const newC = credits + p.value
        setCredits(newC); localStorage.setItem('lw_credits', newC)
      }
    } else {
      setPromoResult({ success: false, label: 'Code not recognized' })
      setTimeout(() => setPromoResult(null), 3000)
    }
  }

  const price = (monthly) => {
    const annual = Math.round(monthly * 10)
    const base = billing === 'annual' ? Math.round(annual/12) : monthly
    if (appliedDiscount) return { old: base, new: Math.round(base * (1 - appliedDiscount/100)) }
    return { old: null, new: base }
  }

  const completeTask = (id, reward) => {
    if (tasks.includes(id)) return
    const t = [...tasks, id]; setTasks(t); localStorage.setItem('lw_completed_tasks', JSON.stringify(t))
    const c = credits + reward; setCredits(c); localStorage.setItem('lw_credits', c)
  }

  const startCountdown = (id, reward) => {
    setCountdowns(c => ({...c, [id]: 10}))
    const iv = setInterval(() => {
      setCountdowns(c => {
        const v = (c[id] || 0) - 1
        if (v <= 0) { clearInterval(iv); completeTask(id, reward); return {...c, [id]: 0} }
        return {...c, [id]: v}
      })
    }, 1000)
  }

  const tasksDone = tasks.reduce((s,id) => s + ({signup:10,youtube:15,rosakay_ig:5,lw_ig:5}[id]||0), 0) + refCount*20
  const refCode = 'LW-' + (Math.random().toString(36).substring(2,10)).toUpperCase()

  const PLANS = [
    { name:'Lone Wolf', price:0, credits:'10 ⚡ on signup', features:['3 generations lifetime','Subtitle & Minimal styles','Basic lyric overlay','10 Lightning Credits ⚡'], missing:['Full timeline editor','Beat drop effects','No watermark','All styles & animations','AI model access'], btn:'Current Plan', popular:false, best:false },
    { name:'Starter', price:9, credits:'100 ⚡/month', features:['50 generations/month','No watermark','All styles + animations','Basic beat detection','100 Credits ⚡/month'], missing:['Full timeline editor','AI model access','Priority processing'], btn:'Coming Soon', popular:false, best:false },
    { name:'Wolf Pro', price:24, credits:'350 ⚡/month', features:['Unlimited generations','Full timeline editor','All styles + beat drop effects','AI model access','Priority processing','350 Credits ⚡/month'], missing:[], btn:'Coming Soon', popular:true, best:false },
    { name:'Pack Leader', price:49, credits:'Unlimited ⚡', features:['Everything in Wolf Pro','4K export','Early access to new AI models','Dedicated support','Unlimited Credits ⚡'], missing:[], btn:'Coming Soon', popular:false, best:true },
  ]

  const CREDITS = [
    { amount:100, price:3, gens:'~10' },{ amount:300, price:8, gens:'~30' },
    { amount:750, price:18, gens:'~75' },{ amount:2000, price:39, gens:'~200' },
  ]

  return (
    <div className="pricing-page">
      <canvas ref={canvasRef} className="wp-particles" />
      <div className="pricing-content">
        <button className="wp-back-btn" onClick={onBack} style={{marginBottom:'24px'}}>← Back</button>

        {/* Header */}
        <div className="pricing-nav">
          <img src="/LightningWolvesLogoTransparentBG.png" alt="LW" style={{height:'32px'}} />
        </div>

        {/* Promo */}
        <div className="promo-bar">
          <span style={{color:'var(--accent)'}}>Have a promo code?</span>
          <input value={promo} onChange={e=>setPromo(e.target.value)} placeholder="e.g. WOLFPACK" style={{textTransform:'uppercase',width:'140px'}} onKeyDown={e=>{if(e.key==='Enter')applyPromo()}} />
          <button className="btn-gold btn-sm" onClick={applyPromo}>Apply</button>
          {promoResult && <span className={promoResult.success?'promo-ok':'promo-err'}>{promoResult.label}</span>}
        </div>

        {/* Title */}
        <div className="pricing-hero">
          <h1 className="pricing-title">CHOOSE YOUR PACK</h1>
          <p className="pricing-sub">Create lyric videos that hit different.</p>
        </div>

        {/* Billing toggle — pill switch */}
        <div className="billing-switch">
          <span className={billing==='monthly'?'billing-active':''} onClick={()=>setBilling('monthly')}>Monthly</span>
          <div className={`billing-pill ${billing==='annual'?'billing-pill-on':''}`} onClick={()=>setBilling(b=>b==='monthly'?'annual':'monthly')}><div className="billing-dot"></div></div>
          <span className={billing==='annual'?'billing-active':''} onClick={()=>setBilling('annual')}>Annual</span>
        </div>

        {/* Plans */}
        <div className="plans-grid">
          {PLANS.map(plan => {
            const p = price(plan.price)
            return (
              <div key={plan.name} className={`plan-card ${plan.popular?'plan-popular':''} ${plan.best?'plan-best':''}`}>
                {plan.popular && <div className="plan-popular-badge">MOST POPULAR</div>}
                {plan.best && <div className="plan-best-badge">BEST VALUE</div>}
                <h3 className="plan-name">{plan.name}</h3>
                <div className="plan-price">
                  {plan.price===0 ? <>
                    <span className="plan-amount">FREE</span>
                    <div className="plan-period">forever</div>
                  </> : <>
                    {p.old!==null && <span className="plan-old">€{p.old}</span>}
                    <span className="plan-amount">€{p.new}</span>
                    <div className="plan-period">/month</div>
                  </>}
                  <div className="plan-credits">{plan.credits}</div>
                </div>
                <ul className="plan-features">{plan.features.map(f=><li key={f}><span className="feat-icon">⚡</span>{f}</li>)}</ul>
                {plan.missing.length > 0 && <ul className="plan-missing">{plan.missing.map(f=><li key={f}>{f}</li>)}</ul>}
                <button className={`btn-full ${plan.popular?'btn-gold':'btn-outline'}`} disabled>{plan.btn}</button>
              </div>
            )
          })}
        </div>
        <p className="plans-note">10 ⚡ = 1 generation</p>

        {/* Credits */}
        <div className="credits-section">
          <h2 className="section-heading">Lightning Credits ⚡</h2>
          <p className="section-sub">No subscription needed. Top up anytime. 10 ⚡ = 1 generation.</p>
          <div className="credits-grid">
            {CREDITS.map(c=>(
              <div key={c.amount} className="credit-pack">
                <div className="credit-amount">{c.amount} ⚡</div>
                <div className="credit-price">€{c.price}</div>
                <div className="credit-gens">{c.gens} generations</div>
                <button className="btn-outline btn-sm btn-full" disabled>Coming Soon</button>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div className="tasks-section">
          <div className="tasks-header">
            <img src="/LightningWolfRoseTransparentBG.png" alt="" className="tasks-wolf-img" />
            <div>
              <h2 className="tasks-heading" style={{color:'#ff80ab'}}>THE PACK LOOKS AFTER ITS OWN. ⚡</h2>
              <p className="tasks-sub">Complete tasks to earn free Lightning Credits. 10 ⚡ = 1 generation.</p>
            </div>
          </div>
          <p className="tasks-earned">You've earned <strong>{tasksDone} ⚡</strong> from tasks</p>
          <div className="tasks-progress">
            <div className="tasks-bar"><div className="tasks-fill" style={{width:`${Math.min(100,tasksDone/60*100)}%`}}></div></div>
            <span className="tasks-label">{tasksDone} / 60 ⚡ earned · 10 ⚡ = 1 generation</span>
          </div>

          <div className="tasks-list">
            {[
              {id:'signup', icon:'✉️', name:'Sign up with email', desc:'Create your account', reward:10},
              {id:'youtube', icon:'▶️', name:'Subscribe on YouTube', desc:'Lightning Wolves channel', reward:15, link:'https://youtube.com/@lightningwolves'},
              {id:'rosakay_ig', icon:'📸', name:'Follow Rosakay on Instagram', desc:'@rosakay_officiel', reward:5, link:'https://www.instagram.com/rosakay_officiel'},
              {id:'lw_ig', icon:'📸', name:'Follow Lightning Wolves', desc:'@lightningwolvesmusic', reward:5, link:'https://www.instagram.com/lightningwolvesmusic'},
            ].map(task => (
              <div key={task.id} className="task-row">
                <span className="task-icon">{task.icon}</span>
                <div className="task-info"><div className="task-name">{task.name}</div><div className="task-desc">{task.desc}</div></div>
                <span className="task-reward">+{task.reward} ⚡</span>
                {tasks.includes(task.id) ? (
                  <span className="task-done">Earned ✓</span>
                ) : countdowns[task.id] > 0 ? (
                  <span className="task-countdown">{countdowns[task.id]}s</span>
                ) : (
                  <button className="btn-gold btn-sm" onClick={() => {
                    if (task.link) { window.open(task.link,'_blank'); startCountdown(task.id, task.reward) }
                    else completeTask(task.id, task.reward)
                  }}>Earn</button>
                )}
              </div>
            ))}
            <div className="task-row">
              <span className="task-icon">👥</span>
              <div className="task-info"><div className="task-name">Refer a friend</div><div className="task-desc">+20 ⚡ per referral · unlimited</div></div>
              <span className="task-reward">+20 ⚡</span>
              <button className="btn-gold btn-sm" onClick={() => navigator.clipboard.writeText(`https://lightningwolves.studio/?ref=${refCode}`)}>Share</button>
            </div>
          </div>

          <div className="referral-box">
            <span>Your referral link:</span>
            <input readOnly value={`https://lightningwolves.studio/?ref=${refCode}`} className="referral-url" />
            <button className="btn-gold btn-sm" onClick={() => navigator.clipboard.writeText(`https://lightningwolves.studio/?ref=${refCode}`)}>Copy ⚡</button>
          </div>
          <p className="referral-stats">You've referred <strong>{refCount}</strong> friends → earned <strong>{refCount*20} ⚡</strong></p>
        </div>
      </div>
    </div>
  )
}

function JoinPackPage({ onBack }) {
  const [form, setForm] = useState({ name:'', artist:'', genre:'', roles:[], otherRole:'', skills:'', socials:[{platform:'',url:''}], music:'', why:'' })
  const [submitted, setSubmitted] = useState(false)
  const canvasRef = useRef(null)
  const update = (k,v) => setForm(f => ({...f,[k]:v}))

  // Gold particles
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); let W,H,particles=[],rafId
    function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight*2}
    resize();window.addEventListener('resize',resize)
    for(let i=0;i<80;i++)particles.push({x:Math.random()*W,y:Math.random()*H,s:Math.random()*2+1,dx:(Math.random()-0.5)*0.3,dy:-(Math.random()*0.3+0.1),a:Math.random()*0.4+0.3})
    function draw(){ctx.clearRect(0,0,W,H);particles.forEach(p=>{p.x+=p.dx;p.y+=p.dy;if(p.y<-10){p.y=H+10;p.x=Math.random()*W}if(p.x<0)p.x=W;if(p.x>W)p.x=0;ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,Math.PI*2);ctx.fillStyle=`rgba(245,197,24,${p.a})`;ctx.fill()});rafId=requestAnimationFrame(draw)}
    draw();return()=>{cancelAnimationFrame(rafId);window.removeEventListener('resize',resize)}
  },[])

  const toggleRole = (r) => setForm(f => ({...f, roles: f.roles.includes(r) ? f.roles.filter(x=>x!==r) : [...f.roles, r]}))
  const addSocial = () => { if(form.socials.length<3) setForm(f=>({...f,socials:[...f.socials,{platform:'',url:''}]})) }
  const updateSocial = (i,k,v) => setForm(f=>{const s=[...f.socials];s[i]={...s[i],[k]:v};return{...f,socials:s}})

  const handleSubmit = (e) => {
    e.preventDefault()
    const saved = JSON.parse(localStorage.getItem('lw_applications') || '[]')
    saved.push({ ...form, status: 'pending', appliedAt: new Date().toISOString() })
    localStorage.setItem('lw_applications', JSON.stringify(saved))
    setSubmitted(true)
  }

  if (submitted) return (
    <div className="join-page">
      <canvas ref={canvasRef} className="wp-particles" />
      <div className="join-success">
        <h2>Application Sent! ⚡</h2>
        <p>We review every application personally. You'll hear from us soon.</p>
        <button className="btn-gold" onClick={onBack}>← Back to Wolves</button>
      </div>
    </div>
  )

  const ROLE_OPTIONS = [
    {id:'artist',label:'🎵 Artist'},{id:'photo',label:'📸 Photography'},{id:'video',label:'🎥 Video'},
    {id:'design',label:'🎨 Design'},{id:'beats',label:'🎧 Beats'},{id:'other',label:'Other'}
  ]

  return (
    <div className="join-page">
      <canvas ref={canvasRef} className="wp-particles" />
      <div className="join-content">
        <div className="join-header">
          <button className="wp-back-btn" onClick={onBack}>← Back</button>
          <h1 className="join-title">Think you run with the wolves?</h1>
          <p className="join-sub">Show us what you got.</p>
        </div>
        <div className="join-split">
          <form className="join-form" onSubmit={handleSubmit}>
            <div className="join-field">
              <label>Real Name *</label>
              <input required value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Your full name" />
            </div>
            <div className="join-field">
              <label>Artist Name *</label>
              <input required value={form.artist} onChange={e=>update('artist',e.target.value)} placeholder="Your stage/artist name" />
            </div>
            <div className="join-field">
              <label>Genre / Style *</label>
              <input required value={form.genre} onChange={e=>update('genre',e.target.value)} placeholder="e.g. Hip-Hop, R&B, Pop..." />
            </div>
            <div className="join-field">
              <label>Role — pick all that apply *</label>
              <div className="join-chips">
                {ROLE_OPTIONS.map(r=>(
                  <button key={r.id} type="button" className={`join-chip ${form.roles.includes(r.id)?'join-chip-active':''}`} onClick={()=>toggleRole(r.id)}>{r.label}</button>
                ))}
              </div>
              {form.roles.includes('other') && <input value={form.otherRole} onChange={e=>update('otherRole',e.target.value)} placeholder="Describe your role..." style={{marginTop:'8px'}} />}
            </div>
            <div className="join-field">
              <label>Your Skills *</label>
              <textarea required value={form.skills} onChange={e=>update('skills',e.target.value)} rows="3" placeholder="Tell us what you're good at..." />
            </div>
            <div className="join-field">
              <label>Social Links <span style={{opacity:0.5}}>(up to 3)</span></label>
              {form.socials.map((s,i)=>(
                <div key={i} className="join-social-row">
                  <select value={s.platform} onChange={e=>updateSocial(i,'platform',e.target.value)}>
                    <option value="">Platform</option>
                    <option>Instagram</option><option>TikTok</option><option>Twitter/X</option><option>YouTube</option><option>Facebook</option>
                  </select>
                  <input value={s.url} onChange={e=>updateSocial(i,'url',e.target.value)} placeholder="https://..." />
                </div>
              ))}
              {form.socials.length<3 && <button type="button" className="join-add-link" onClick={addSocial}>+ Add another</button>}
            </div>
            <div className="join-field">
              <label>Music Link</label>
              <input value={form.music} onChange={e=>update('music',e.target.value)} placeholder="Spotify, SoundCloud, Apple Music..." />
            </div>
            <div className="join-field">
              <label>Why do you want to join Lightning Wolves? *</label>
              <textarea required value={form.why} onChange={e=>update('why',e.target.value)} rows="4" placeholder="Make it count..." />
            </div>
            <button type="submit" className="btn-gold btn-full">Send it ⚡</button>
          </form>
          <div className="join-sidebar">
            <div className="join-sidebar-card">
              <h3 className="join-sidebar-title">The Pack</h3>
              <div className="join-wolves-list">
                <div className="join-wolf-row"><span className="join-wolf-dot" style={{background:'#f5c518'}}></span>Lazy Jo</div>
                <div className="join-wolf-row"><span className="join-wolf-dot" style={{background:'#9b6dff'}}></span>Zirka</div>
                <div className="join-wolf-row"><span className="join-wolf-dot" style={{background:'#ff9500'}}></span>Rosakay</div>
                <div className="join-wolf-row"><span className="join-wolf-dot" style={{background:'#82b1ff'}}></span>Drippydesigns</div>
                <div className="join-wolf-row"><span className="join-wolf-dot" style={{background:'#69f0ae'}}></span>Shiteux</div>
              </div>
            </div>
            <p className="join-sidebar-note">We review every application personally.</p>
            <p className="join-sidebar-roles">Open roles: videographer, designer, beatmaker, artist.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function WolfSelectPage({ onSelectWolf, onJoinPack, onPricing, onShowAuth, onWolfHub }) {
  useEffect(() => {
    // Force all videos to play immediately — multiple retries for staggered loads
    const playAll = () => {
      document.querySelectorAll('#wolf-select-page video').forEach(v => {
        v.muted = true; v.play().catch(() => {});
      });
    };
    playAll();
    const t1 = setTimeout(playAll, 100);
    const t2 = setTimeout(playAll, 300);
    const t3 = setTimeout(playAll, 600);
    const t4 = setTimeout(playAll, 1000);
    const t5 = setTimeout(playAll, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, []);

  return (
    <div id="wolf-select-page" className="page">
      <header className="select-header">
        <a href="/" className="header-logo-link">
          <img src="/LightningWolvesLogoTransparentBG.png" alt="Lightning Wolves" className="header-logo" onError={e => e.target.style.display='none'} />
        </a>
        <div className="header-right">
          <button className="nav-btn-gold" onClick={() => onSelectWolf({ id: 'public', color: '#f5c518', artist: '', genre: '', image: 'logo.svg' })}>
            Enter Studio
          </button>
          <span className="nav-link" onClick={onPricing} style={{cursor:'pointer'}}>Pricing</span>
          <span className="nav-btn-outline" onClick={onShowAuth} style={{cursor:'pointer'}}>SIGN IN</span>
        </div>
      </header>

      <main className="select-main">
        <h1 className="select-tagline">WHICH WOLF ARE YOU?</h1>
        <div className="wolf-grid-outer">
          <div className="wolf-grid-inner">
            <div className="wolf-grid">
              {WOLVES.map(wolf => {
                const isLocked = wolf.locked && !wolf.comingSoon;
                const isComingSoon = wolf.comingSoon;
                const isJoin = wolf.isJoinCard;
                return (
                  <div key={wolf.id}
                    className={`wolf-card-new ${(isJoin || wolf.isLoneWolf) ? 'wolf-card-lone' : ''} ${isLocked ? 'wolf-card-locked' : ''} ${isComingSoon ? 'wolf-card-soon' : ''}`}
                    style={{'--wc': wolf.color}}
                    onClick={() => {
                      if (isLocked || isComingSoon) return;
                      if (wolf.isLoneWolf) onSelectWolf({ id: 'public', color: '#f5c518', artist: '', genre: '', image: 'logo.svg' });
                      else if (isJoin) onJoinPack();
                      else onSelectWolf(wolf);
                    }}>
                    <div className="wolf-card-img-circle">
                      {isLocked ? (
                        <div className="wolf-lock-icon">🔒</div>
                      ) : wolf.emoji ? (
                        <div className="wolf-emoji-icon">{wolf.emoji}</div>
                      ) : wolf.video ? (
                        <video autoPlay loop muted playsInline preload="auto"
                          onLoadedData={e => e.target.play()}
                          style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}}>
                          <source src={wolf.video} type="video/mp4" />
                        </video>
                      ) : (
                        <img src={`/${wolf.image}`} alt={wolf.artist} />
                      )}
                    </div>
                    <div className="wolf-card-name">{wolf.artist}</div>
                    <div className="wolf-card-genre">{wolf.genre}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
      <footer className="wolfhub-footer">
        <span className="wolfhub-egg" onClick={onWolfHub}>🐺</span>
      </footer>
    </div>
  )
}

// ─── Studio Page ──────────────────────────────────────────────────────────────
function StudioPage({ wolf, user, profile, token, supabase, onChangeWolf, onShowAuth, onSignOut, onOpenDashboard, onShowLimitModal }) {
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
  const [dragover,     setDragover]     = useState(false)
  const fileInputRef = useRef(null)

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
    setUploadInfo({ text: `✓ ${file.name} · ${sizeMB} MB`, color: '#3ddc84' })
  }

  async function handleGenerate() {
    setGenError('')
    if (!title || !artist || !genre) { setGenError('Please fill in Song Title, Artist Name, and Genre.'); return }
    if (generating) return
    setGenerating(true)
    setPack(null); setMeta(null)
    try {
      const body = { title, artist, genre, language, wolfId: wolf?.id }
      if (bpm)   body.bpm  = bpm
      if (mood)  body.mood = mood
      if (token) body.token = token

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
    setUploadInfo(null); setPack(null); setMeta(null); setGenError('')
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

  const planBadge = profile?.role === 'member' ? 'WOLF PACK' : (user ? 'FREE' : 'PUBLIC')
  const planClass = profile?.role === 'member' ? 'plan-badge member' : 'plan-badge'

  return (
    <div id="studio-page" className="page">
      <header className="studio-header">
        <div className="studio-header-left">
          <img src="/LightningWolvesLogoTransparentBG.png" alt="LW" className="studio-logo"
               onError={e => e.target.style.display='none'} />
          <div className="studio-titles">
            <div className="studio-brand">LIGHTNING WOLVES / Lyrics Studio</div>
          </div>
        </div>
        <div className="studio-header-right">
          <span className="artist-dot" style={{ background: wolf?.color, boxShadow: `0 0 8px ${wolf?.color}` }}></span>
          <span className="artist-name-header">{wolf?.artist || ''}</span>
          <span className={planClass}>{planBadge}</span>
          <button className="btn-outline" onClick={onChangeWolf}>Change Wolf</button>
          {user ? (
            <>
              {profile?.role === 'member' && <button className="btn-ghost" onClick={onOpenDashboard}>Dashboard</button>}
              <button className="btn-ghost" onClick={onSignOut}>Sign Out</button>
            </>
          ) : (
            <button className="btn-ghost" onClick={onShowAuth}>Sign In</button>
          )}
        </div>
      </header>

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
            <span className="btn-text">{generating ? 'GENERATING…' : 'GENERATE'}</span>
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

// ─── Wolf Hub (hidden page) ──────────────────────────────────────────────────
// Dot positions mapped for a FRONT-FACING wolf head
const WOLF_HUB_DOTS = [
  { country: 'Ghana',   flag: '🇬🇭', top: '18%', left: '50%' },  // forehead center
  { country: 'USA',     flag: '🇺🇸', top: '32%', left: '30%' },  // left eye
  { country: 'UK',      flag: '🇬🇧', top: '32%', left: '70%' },  // right eye
  { country: 'Belgium', flag: '🇧🇪', top: '50%', left: '28%' },  // left cheek
  { country: 'France',  flag: '🇫🇷', top: '50%', left: '72%' },  // right cheek
  { country: 'Nigeria', flag: '🇳🇬', top: '62%', left: '50%' },  // snout / nose
]

const COUNTRY_ARTISTS = {
  Belgium: [
    { wolfId: 'yellow', name: 'Lazy Jo', genre: 'Melodic Hip-Hop', color: '#f5c518', image: 'LightningWolfYellowTransparentBG.png', video: '/LazyJoWolfAnimation.mp4' },
    { wolfId: 'purple', name: 'Zirka', genre: 'French Hip-Hop', color: '#9b6dff', image: 'LightningWolfPurpleTransparentBG.png', video: '/Wolf-Purple.mp4' },
    { wolfId: 'orange', name: 'Rosakay', genre: 'Pop / French Pop', color: '#ff9500', image: 'LightningWolfOrangeTransparentBG.png', video: '/RosakayWolfAnimation.mp4' },
  ],
  Ghana: [
    { wolfId: 'yellow', name: 'Lazy Jo', genre: 'Melodic Hip-Hop', color: '#f5c518', image: 'LightningWolfYellowTransparentBG.png', video: '/LazyJoWolfAnimation.mp4', note: 'Ghanaian roots' },
  ],
  France: null,
  USA: null,
  UK: null,
  Nigeria: null,
}

function WolfHubPage({ onBack, onCountry, onVersus, profile }) {
  const [tooltip, setTooltip] = useState(null)
  const canvasRef = useRef(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const [zooming, setZooming] = useState(null)
  const [labelView, setLabelView] = useState(false)
  const isMember = profile?.role === 'member' // country name when zooming

  useEffect(() => {
    const container = canvasRef.current
    if (!container) return

    const w = container.clientWidth
    const h = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100)
    // Camera at standard +Z, model will be rotated to face it
    camera.position.set(0, 1, 5)
    camera.lookAt(0, 0.7, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    container.appendChild(renderer.domElement)

    // Lighting — cinematic gold, avoid washing out the face
    scene.add(new THREE.AmbientLight(0x111111, 1))

    // Soft front fill — low intensity so textures show through
    const frontFill = new THREE.PointLight(0xFFB800, 1.5, 12)
    frontFill.position.set(0, 1, 5)
    scene.add(frontFill)

    // Key light — from upper-right, creates dramatic shadows on face
    const keyLight = new THREE.DirectionalLight(0xFFB800, 3)
    keyLight.position.set(3, 4, 3)
    scene.add(keyLight)

    // Strong side/rim lights — make the fur edges glow gold
    const rimLeft = new THREE.DirectionalLight(0xFF8C00, 4)
    rimLeft.position.set(-5, 2, 0)
    scene.add(rimLeft)
    const rimRight = new THREE.DirectionalLight(0xFFB800, 4)
    rimRight.position.set(5, 2, 0)
    scene.add(rimRight)

    // Back rim — silhouette glow
    const rimBack = new THREE.DirectionalLight(0xFFD700, 3)
    rimBack.position.set(0, 3, -5)
    scene.add(rimBack)

    // Load GLB with Draco
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)

    let model = null
    let baseRotationY = 0
    gltfLoader.load('/Optimized_Wolf.glb', (gltf) => {
      model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = 2.4 / maxDim
      model.scale.setScalar(scale)
      model.position.sub(center.multiplyScalar(scale))
      model.position.y += 0.7

      // 180° showed back of head — model faces +Z by default, camera is at +Z
      // So 0° = face toward camera
      model.rotation.y = 0
      baseRotationY = 0

      scene.add(model)
    }, undefined, (err) => {
      console.error('[WolfHub] GLB load error:', err)
    })

    // Mouse/touch tilt tracking
    function onPointerMove(e) {
      const rect = container.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      mouseRef.current.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2
    }
    container.addEventListener('pointermove', onPointerMove)

    // Animate — mouse-reactive tilt, no auto-rotation
    let raf
    const camTarget = { z: 5, y: 1 }

    function animate() {
      raf = requestAnimationFrame(animate)

      if (model) {
        const tiltX = mouseRef.current.y * -0.15
        const tiltY = baseRotationY + mouseRef.current.x * 0.15
        model.rotation.x += (tiltX - model.rotation.x) * 0.04
        model.rotation.y += (tiltY - model.rotation.y) * 0.04
      }

      // Maw zoom — camera pushes along Z into wolf's snout
      camera.position.z += (camTarget.z - camera.position.z) * 0.04
      camera.position.y += (camTarget.y - camera.position.y) * 0.04

      renderer.render(scene, camera)
    }
    animate()

    // Expose zoom trigger — pushes camera into the snout along X
    container._triggerZoom = () => {
      camTarget.z = 1.5
      camTarget.y = 0.7
    }
    container._resetZoom = () => {
      camTarget.z = 5
      camTarget.y = 1
    }

    function onResize() {
      const nw = container.clientWidth
      const nh = container.clientHeight
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      container.removeEventListener('pointermove', onPointerMove)
      renderer.dispose()
      dracoLoader.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [])

  function handleCountryClick(country) {
    const container = canvasRef.current
    if (container?._triggerZoom) container._triggerZoom()
    setZooming(country)

    // After Maw zoom: countries with artists → Versus swipe, others → country page
    const hasArtists = COUNTRY_ARTISTS[country] && COUNTRY_ARTISTS[country].length > 0
    setTimeout(() => {
      if (container?._resetZoom) container._resetZoom()
      setZooming(null)
      if (hasArtists) {
        onVersus(country)
      } else {
        onCountry(country)
      }
    }, 1200)
  }

  return (
    <div className="wolfhub-page">
      {/* Maw zoom overlay */}
      {zooming && (
        <div className="wolfhub-maw-overlay" key={zooming}>
          <div className="wolfhub-maw-text">{zooming.toUpperCase()}</div>
        </div>
      )}

      <button className="wolfhub-back" onClick={onBack}>← Back</button>

      {/* Label View toggle — only for members */}
      {isMember && (
        <div className="wolfhub-label-toggle">
          <label className="wolfhub-label-switch">
            <input type="checkbox" checked={labelView} onChange={e => setLabelView(e.target.checked)} />
            <span className="wolfhub-label-slider"></span>
          </label>
          <span className="wolfhub-label-text">LABEL VIEW</span>
        </div>
      )}

      <div className="wolfhub-center">
        <h1 className="wolfhub-title">WOLF HUB</h1>
        <p className="wolfhub-subtitle">SELECT YOUR TERRITORY</p>

        <div className={`wolfhub-head-wrap ${labelView ? 'wolfhub-charged' : ''}`}>
          <div className="wolfhub-glow"></div>
          {labelView && <div className="wolfhub-lightning-charge"></div>}
          <div ref={canvasRef} className="wolfhub-3d-canvas"></div>

          {WOLF_HUB_DOTS.map(dot => (
            <div key={dot.country}
              className="wolfhub-dot"
              style={{ top: dot.top, left: dot.left }}
              onMouseEnter={() => setTooltip(dot.country)}
              onMouseLeave={() => setTooltip(null)}
              onClick={() => handleCountryClick(dot.country)}
            >
              <div className="wolfhub-dot-ping"></div>
              {tooltip === dot.country && (
                <div className="wolfhub-tooltip">{dot.flag} {dot.country}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Wolf Hub Country Page ───────────────────────────────────────────────────
function WolfHubCountryPage({ country, onBack, onSelectWolf }) {
  const dot = WOLF_HUB_DOTS.find(d => d.country === country)
  const artists = COUNTRY_ARTISTS[country]
  const hasArtists = artists && artists.length > 0

  function handleArtistClick(a) {
    const wolfData = WOLVES.find(w => w.id === a.wolfId)
    if (wolfData) onSelectWolf(wolfData)
  }

  return (
    <div className="wolfhub-page">
      <button className="wolfhub-back" onClick={onBack}>← Back to Wolf Hub</button>

      <div className="wolfhub-country-content">
        <div className="wolfhub-country-flag">{dot?.flag}</div>
        <h1 className="wolfhub-title">{country.toUpperCase()}</h1>

        {hasArtists ? (
          <div className="wolfhub-artists-grid">
            {artists.map(a => (
              <div key={a.wolfId + a.name} className="wolfhub-artist-card" style={{'--wc': a.color}}
                   onClick={() => handleArtistClick(a)}>
                <div className="wolfhub-artist-img-wrap">
                  {a.video ? (
                    <video autoPlay loop muted playsInline preload="auto"
                      onLoadedData={e => e.target.play().catch(()=>{})}
                      style={{width:'100%',height:'100%',borderRadius:'50%',objectFit:'cover'}}>
                      <source src={a.video} type="video/mp4" />
                    </video>
                  ) : (
                    <img src={`/${a.image}`} alt={a.name} />
                  )}
                </div>
                <div className="wolfhub-artist-name">{a.name}</div>
                <div className="wolfhub-artist-genre">{a.genre}</div>
                {a.note && <div className="wolfhub-artist-note">{a.note}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="wolfhub-coming-soon">
            <div className="wolfhub-coming-icon">🐺</div>
            <h2 className="wolfhub-coming-title">COMING SOON</h2>
            <p className="wolfhub-coming-sub">Artists dropping soon</p>
          </div>
        )}

        {hasArtists && country === 'Ghana' && (
          <div className="wolfhub-more-wolves">More wolves coming soon</div>
        )}
      </div>
    </div>
  )
}

// ─── Join The Pack — Hinge-Style Onboarding Gate ─────────────────────────────
function JoinPackGate({ onComplete, onSkip }) {
  const [step, setStep] = useState(1) // 1=photo+name, 2=prompts, 3=howl
  const [name, setName] = useState('')
  const [genre, setGenre] = useState('')
  const [imgUrl, setImgUrl] = useState('')
  const [prompt1, setPrompt1] = useState('')
  const [prompt2, setPrompt2] = useState('')
  const [howlText, setHowlText] = useState('')
  const [unlocking, setUnlocking] = useState(false)

  function handlePhoto(e) {
    const file = e.target.files[0]
    if (file) setImgUrl(URL.createObjectURL(file))
  }

  function handleSubmit() {
    setUnlocking(true)
    setTimeout(() => {
      onComplete({
        name, genre, image: imgUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
        prompts: { flowLike: prompt1, lookingFor: prompt2 },
        howlSnippet: howlText,
      })
    }, 2000)
  }

  if (unlocking) {
    return (
      <div className="jpgate-unlock">
        <div className="jpgate-flash"></div>
        <div className="jpgate-unlock-content">
          <div className="jpgate-unlock-bolt">⚡</div>
          <h2 className="jpgate-unlock-title">WELCOME TO THE PACK</h2>
          <p className="jpgate-unlock-sub">{name.toUpperCase()}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="jpgate-overlay">
      <div className="jpgate-modal">
        <div className="jpgate-header">
          <img src="/LightningWolvesLogoTransparentBG.png" alt="" className="jpgate-logo" onError={e=>e.target.style.display='none'} />
          <h1 className="jpgate-title">JOIN THE PACK</h1>
          <p className="jpgate-sub">Create your Wolf Profile to enter the Hub</p>
        </div>

        <div className="jpgate-steps">
          <div className={`jpgate-step-dot ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className={`jpgate-step-line ${step >= 2 ? 'active' : ''}`}></div>
          <div className={`jpgate-step-dot ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className={`jpgate-step-line ${step >= 3 ? 'active' : ''}`}></div>
          <div className={`jpgate-step-dot ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>

        {step === 1 && (
          <div className="jpgate-form">
            <div className="wpf-photo" onClick={() => document.getElementById('jpgate-photo').click()}>
              {imgUrl ? <img src={imgUrl} alt="" /> : <span>📷<br/>TAP TO UPLOAD</span>}
              <input id="jpgate-photo" type="file" accept="image/*" hidden onChange={handlePhoto} />
            </div>
            <div className="field-group"><label className="field-label">WOLF NAME *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your artist name" /></div>
            <div className="field-group"><label className="field-label">GENRE *</label>
              <select value={genre} onChange={e => setGenre(e.target.value)}>
                <option value="">Select your sound…</option>
                {['Melodic Hip-Hop','Hip-Hop','Drill','Afrobeats','R&B','Trap','Pop','French Hip-Hop','French Pop','Amapiano','Dark Trap','Rock','Other'].map(g => <option key={g} value={g}>{g}</option>)}
              </select></div>
            <button className="btn-gold btn-full" disabled={!name || !genre} onClick={() => setStep(2)}>NEXT →</button>
          </div>
        )}

        {step === 2 && (
          <div className="jpgate-form">
            <div className="jpgate-prompt-card">
              <label className="jpgate-prompt-label">🎤 MY FLOW IS LIKE...</label>
              <input type="text" value={prompt1} onChange={e => setPrompt1(e.target.value)} placeholder='e.g. "Lazy Jo meets Drake vibes"' />
            </div>
            <div className="jpgate-prompt-card">
              <label className="jpgate-prompt-label">🐺 I'M LOOKING FOR A WOLF WHO...</label>
              <input type="text" value={prompt2} onChange={e => setPrompt2(e.target.value)} placeholder='e.g. "Can drop a hard Drill verse in 24h"' />
            </div>
            <div className="jpgate-nav">
              <button className="btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn-gold" disabled={!prompt1 && !prompt2} onClick={() => setStep(3)}>NEXT →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="jpgate-form">
            <div className="jpgate-prompt-card">
              <label className="jpgate-prompt-label">🔊 THE HOWL — Your Best Bar</label>
              <textarea value={howlText} onChange={e => setHowlText(e.target.value)} rows={3}
                placeholder='Drop your hardest lyric or describe your sound…' />
            </div>
            <div className="jpgate-nav">
              <button className="btn-ghost" onClick={() => setStep(2)}>← Back</button>
              <button className="jpgate-submit" onClick={handleSubmit}>
                ⚡ BECOME A LONE WOLF
              </button>
            </div>
          </div>
        )}

        <button className="jpgate-skip" onClick={onSkip}>Skip for now →</button>
      </div>
    </div>
  )
}

// ─── Pack Chat Window ────────────────────────────────────────────────────────
function PackChatWindow({ matchName, wolfProfile, onClose }) {
  const genre = wolfProfile?.genre || 'music'
  const [messages, setMessages] = useState([
    { from: 'system', text: `⚡ PACK UNITED! You and ${matchName} matched.` },
    { from: 'system', text: `💡 Collab starter: "Yo! Our vibes match. Let's create a ${genre} track together!"` }
  ])
  const [input, setInput] = useState('')

  function send() {
    if (!input.trim()) return
    setMessages(m => [...m, { from: 'you', text: input.trim() }])
    setInput('')
    // Simulate reply
    setTimeout(() => {
      setMessages(m => [...m, { from: matchName, text: "Yo, let's cook something crazy! 🔥" }])
    }, 1500)
  }

  return (
    <div className="pack-chat">
      <div className="pack-chat-header">
        <span className="pack-chat-title">🐺 PACK CHAT — {matchName}</span>
        <button className="btn-ghost btn-sm" onClick={onClose}>✕</button>
      </div>
      <div className="pack-chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`pack-chat-msg pack-chat-${m.from === 'you' ? 'you' : m.from === 'system' ? 'system' : 'them'}`}>
            {m.from !== 'system' && <span className="pack-chat-sender">{m.from === 'you' ? 'You' : m.from}</span>}
            <span className="pack-chat-text">{m.text}</span>
          </div>
        ))}
      </div>
      <div className="pack-chat-input">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Type your message…" onKeyDown={e => e.key === 'Enter' && send()} />
        <button className="btn-gold btn-sm" onClick={send}>Send</button>
      </div>
    </div>
  )
}

// ─── Versus Swipe Screen (PS2-style) ─────────────────────────────────────────
const MOCK_WOLVES = [
  { name: 'Wolf_99', genre: 'Drill', seed: 'wolf99', potential: 87, gens: 24,
    flowLike: 'Pop Smoke meets UK energy', lookingFor: 'Producer with dark 808s', howl: '"Walk in the room, they already know the name..."' },
  { name: 'Viper_X', genre: 'Afrobeats', seed: 'viperx', potential: 72, gens: 12,
    flowLike: 'Burna Boy x Wizkid fusion', lookingFor: 'Melodic hook writer for a summer anthem', howl: '"Sun go down, rhythm still alive..."' },
  { name: 'Ghost_Writer', genre: 'Dark Trap', seed: 'ghost', potential: 91, gens: 38,
    flowLike: 'Travis Scott in a haunted cathedral', lookingFor: 'Vocalist for a cinematic intro', howl: '"Shadows don\'t sleep, neither do I..."' },
  { name: 'Luna_Soul', genre: 'R&B', seed: 'luna', potential: 68, gens: 8,
    flowLike: 'SZA meets French elegance', lookingFor: 'Beat maker with smooth jazz samples', howl: '"Under the moonlight, I found my frequency..."' },
  { name: 'Blitz_MC', genre: 'Grime', seed: 'blitz', potential: 79, gens: 19,
    flowLike: 'Skepta energy with Stormzy depth', lookingFor: 'Anyone ready to clash on a beat', howl: '"Step to the mic, no second takes..."' },
]

function VersusSwipePage({ wolf, city, onBack, profile, wolfProfile }) {
  const [deck, setDeck] = useState([...MOCK_WOLVES])
  const [matched, setMatched] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [swiping, setSwiping] = useState(null)
  const [howlActive, setHowlActive] = useState(false)
  const [superHowled, setSuperHowled] = useState({})
  const [scouted, setScouted] = useState({})

  const isMember = profile?.role === 'member'
  const wp = wolfProfile // user's wolf profile data

  function swipe(dir) {
    if (!deck.length || swiping) return
    setSwiping(dir)
    if (dir === 'right') {
      setHowlActive(true)
      const isMatch = Math.random() > 0.4
      setTimeout(() => {
        setHowlActive(false)
        if (isMatch) setMatched(deck[0].name)
        setSwiping(null)
        setDeck(d => d.slice(1))
      }, 800)
    } else {
      setTimeout(() => { setSwiping(null); setDeck(d => d.slice(1)) }, 500)
    }
  }

  function superHowl() {
    if (!deck.length) return
    setSuperHowled(s => ({ ...s, [deck[0].name]: true }))
    swipe('right')
  }

  const current = deck[0]

  return (
    <div className="vs-page">
      {matched && !chatOpen && (
        <div className="vs-match-overlay">
          <div className="vs-match-flash"></div>
          <div className="vs-match-content">
            <h2 className="vs-match-title">PACK UNITED!</h2>
            <p className="vs-match-sub">You and {matched} are now connected</p>
            <button className="btn-gold" onClick={() => setChatOpen(true)}>Start Collaboration</button>
            <button className="btn-ghost" onClick={() => setMatched(null)} style={{marginTop:'8px'}}>Later</button>
          </div>
        </div>
      )}

      {chatOpen && matched && (
        <PackChatWindow matchName={matched} wolfProfile={wp} onClose={() => { setChatOpen(false); setMatched(null) }} />
      )}

      <button className="wolfhub-back" onClick={onBack}>← Back to Hub</button>
      {city && <div className="vs-city-badge">{WOLF_HUB_DOTS.find(d => d.country === city)?.flag} {city.toUpperCase()}</div>}

      <div className="vs-arena">
        {/* YOUR card — populated from wolfProfile */}
        <div className="vs-card-slot vs-left">
          <div className="vs-card">
            <div className="vs-card-img">
              {wp?.image ? (
                <img src={wp.image} alt={wp.name} />
              ) : wolf?.video ? (
                <video autoPlay loop muted playsInline style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'12px'}}>
                  <source src={wolf.video} type="video/mp4" />
                </video>
              ) : (
                <img src={`/${wolf?.image || 'LightningWolvesLogoTransparentBG.png'}`} alt="You" />
              )}
            </div>
            <div className="vs-card-name">{wp?.name || wolf?.artist || 'You'}</div>
            <div className="vs-card-genre">{wp?.genre || wolf?.genre || 'Lightning Wolf'}</div>
            {wp?.prompts?.flowLike && <div className="vs-prompt">🎤 {wp.prompts.flowLike}</div>}
            {wp?.howlSnippet && <div className="vs-howl-snippet">"{wp.howlSnippet}"</div>}
          </div>
          <div className="vs-card-label">YOU</div>
        </div>

        {/* Center — HOWL + Super-Howl */}
        <div className="vs-center">
          <div className={`vs-howl-text ${howlActive ? 'vs-howl-active' : ''}`}>
            {howlActive ? '⚡' : 'HOWL'}
          </div>
          {current && (
            <button className={`vs-super-howl ${superHowled[current?.name] ? 'used' : ''}`}
              onClick={superHowl} disabled={superHowled[current?.name]} title="Super-Howl — Priority notification">
              ⚡
            </button>
          )}
        </div>

        {/* OPPONENT card — Hinge-style prompts */}
        <div className="vs-card-slot vs-right">
          {current ? (
            <div className={`vs-card ${swiping === 'left' ? 'vs-swipe-left' : ''} ${swiping === 'right' ? 'vs-swipe-right' : ''}`}>
              <div className="vs-card-img">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${current.seed}`} alt={current.name} />
              </div>
              <div className="vs-card-name">{current.name}</div>
              <div className="vs-card-genre">{current.genre}</div>
              {superHowled[current.name] && <div className="vs-super-badge">⚡ SUPER-HOWL SENT</div>}

              {/* Hinge-style prompts */}
              {current.flowLike && <div className="vs-prompt">🎤 <em>My flow is like...</em> {current.flowLike}</div>}
              {current.lookingFor && <div className="vs-prompt">🐺 <em>Looking for...</em> {current.lookingFor}</div>}
              {current.howl && (
                <div className="vs-howl-snippet">
                  <span className="vs-howl-play">▶</span> {current.howl}
                </div>
              )}

              {/* Label Scout data */}
              {isMember && (
                <div className="vs-label-data">
                  <div className="vs-label-stat">🎯 Potential: <strong>{current.potential}</strong></div>
                  <div className="vs-label-stat">⚡ Gens: <strong>{current.gens}</strong></div>
                  {!scouted[current.name] ? (
                    <button className="vs-scout-btn" onClick={(e) => { e.stopPropagation(); setScouted(s => ({...s, [current.name]: true})) }}>
                      🐺 SCOUT — Invite to Label
                    </button>
                  ) : <div className="vs-scouted">✓ INVITATION SENT</div>}
                </div>
              )}
            </div>
          ) : (
            <div className="vs-empty">No more wolves in {city || 'this territory'}</div>
          )}
          <div className="vs-card-label">LONE WOLF</div>
        </div>
      </div>

      {current && (
        <div className="vs-actions">
          <button className="vs-btn vs-pass" onClick={() => swipe('left')}>✖ PASS</button>
          <button className="vs-btn vs-howl" onClick={() => swipe('right')}>🐺 HOWL</button>
        </div>
      )}
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

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page,           setPage]           = useState('wolf-select')
  const [wolf,           setWolf]           = useState(null)
  const [user,           setUser]           = useState(null)
  const [profile,        setProfile]        = useState(null)
  const [token,          setToken]          = useState(null)
  const [supabase,       setSupabase]       = useState(null)
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [hubCountry,     setHubCountry]     = useState(null)
  const [wolfProfile,    setWolfProfile]    = useState(null)  // Hinge-style profile
  const [showJoinGate,   setShowJoinGate]   = useState(false)

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
    // Public/guest goes to studio directly, named wolves go to profile
    if (w.id === 'public') {
      setPage('studio')
    } else {
      setPage('wolf-profile')
    }
  }

  function handleEnterStudio(w) {
    setWolf(w)
    setPage('studio')
  }

  function handleAuth(authUser, authToken) {
    setUser(authUser)
    setToken(authToken)
    if (authUser && supabase) fetchProfile(supabase, authUser.id)
    setPage(wolf ? 'studio' : 'wolf-select')
  }

  async function handleSignOut() {
    if (supabase) await supabase.auth.signOut()
    setUser(null); setToken(null); setProfile(null)
    setPage('wolf-select')
  }

  return (
    <>
      <LightningCanvas wolfColor={wolf?.color || '#f5c518'} />

      {page === 'wolf-select' && (
        <WolfSelectPage onSelectWolf={handleSelectWolf} onJoinPack={() => setPage('join-pack')} onPricing={() => setPage('pricing')} onShowAuth={() => setPage('auth')}
          onWolfHub={() => { if (wolfProfile) { setPage('wolf-hub') } else { setShowJoinGate(true) } }} />
      )}

      {page === 'join-pack' && (
        <JoinPackPage onBack={() => setPage('wolf-select')} />
      )}

      {page === 'pricing' && (
        <PricingPage onBack={() => setPage('wolf-select')} />
      )}

      {page === 'wolf-profile' && wolf && (
        <WolfProfilePage
          wolf={wolf}
          onBack={() => setPage('wolf-select')}
          onEnterStudio={handleEnterStudio}
        />
      )}

      {page === 'auth' && (
        <AuthPage
          supabase={supabase}
          onAuth={handleAuth}
          onGuest={() => setPage('wolf-select')}
        />
      )}

      {page === 'studio' && (
        <StudioPage
          wolf={wolf}
          user={user}
          profile={profile}
          token={token}
          supabase={supabase}
          onChangeWolf={() => setPage('wolf-select')}
          onShowAuth={() => setPage('auth')}
          onSignOut={handleSignOut}
          onOpenDashboard={() => setPage('dashboard')}
          onShowLimitModal={() => setShowLimitModal(true)}
        />
      )}

      {page === 'wolf-hub' && (
        <WolfHubPage
          onBack={() => setPage('wolf-select')}
          onCountry={(c) => { setHubCountry(c); setPage('wolf-hub-country') }}
          onVersus={(c) => { setHubCountry(c); setPage('versus') }}
          profile={profile}
        />
      )}

      {page === 'wolf-hub-country' && hubCountry && (
        <WolfHubCountryPage country={hubCountry} onBack={() => setPage('wolf-hub')} onSelectWolf={handleSelectWolf} />
      )}

      {page === 'versus' && (
        <VersusSwipePage wolf={wolf} city={hubCountry} onBack={() => setPage('wolf-hub')} profile={profile} wolfProfile={wolfProfile} />
      )}

      {page === 'dashboard' && (
        <DashboardPage
          wolf={wolf}
          profile={profile}
          token={token}
          onBack={() => setPage('studio')}
          onSignOut={handleSignOut}
        />
      )}

      {showLimitModal && (
        <LimitModal
          onClose={() => setShowLimitModal(false)}
          onSignup={() => { setShowLimitModal(false); setPage('auth') }}
        />
      )}

      {showJoinGate && (
        <JoinPackGate
          onComplete={(wp) => { setWolfProfile(wp); setShowJoinGate(false); setPage('wolf-hub') }}
          onSkip={() => { setShowJoinGate(false); setPage('wolf-hub') }}
        />
      )}
    </>
  )
}
