import { useState, useEffect, useRef } from 'react'
import { LYRIC_STYLES, detectBeats, drawLyricFrame, generateASS } from './LyricVideo'

const ANIMATIONS = ['Slam', 'Fade', 'Glitch', 'Pop', 'Typewriter']
const POSITIONS = ['top', 'center', 'bottom']
const BEAT_EFFECTS = [
  { id: 'flash', label: 'Flash' },
  { id: 'zoom', label: 'Zoom' },
  { id: 'shake', label: 'Shake' },
  { id: 'color', label: 'Color Burst' },
]

async function getWaveformData(file, barCount = 300) {
  const audioCtx = new AudioContext()
  const buf = await audioCtx.decodeAudioData(await file.arrayBuffer())
  const raw = buf.getChannelData(0)
  const step = Math.floor(raw.length / barCount)
  const bars = []
  for (let i = 0; i < barCount; i++) {
    let sum = 0
    for (let j = 0; j < step; j++) sum += Math.abs(raw[i * step + j] || 0)
    bars.push(sum / step)
  }
  const max = Math.max(...bars, 0.001)
  await audioCtx.close()
  return { bars: bars.map(b => b / max), duration: buf.duration }
}

// ─── Toast System ────────────────────────────────────────────────────────────
function ToastContainer({ toasts }) {
  return (
    <div className="le-toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`le-toast le-toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  )
}

// ─── Onboarding Guide ────────────────────────────────────────────────────────
const ONBOARD_STEPS = [
  { title: 'Upload your track ⚡', desc: 'Drop an audio or video file to get started.' },
  { title: 'Lyrics sync automatically', desc: 'We transcribe and time every word for you.' },
  { title: 'Pick your style', desc: 'Choose from Karaoke, Pop, Subtitle, Glitch, or Minimal.' },
  { title: 'Customize everything', desc: 'Colors, fonts, positions, beat effects — all yours.' },
  { title: 'Export and share', desc: 'Download your lyric video ready for TikTok, Reels, or YouTube.' },
]

function OnboardingGuide({ onDismiss }) {
  const [step, setStep] = useState(0)
  return (
    <div className="le-onboard-overlay">
      <div className="le-onboard-card">
        <div className="le-onboard-step-num">Step {step + 1} of {ONBOARD_STEPS.length}</div>
        <h3 className="le-onboard-title">{ONBOARD_STEPS[step].title}</h3>
        <p className="le-onboard-desc">{ONBOARD_STEPS[step].desc}</p>
        <div className="le-onboard-dots">
          {ONBOARD_STEPS.map((_, i) => <div key={i} className={`le-onboard-dot${i === step ? ' active' : ''}`} />)}
        </div>
        <div className="le-onboard-actions">
          {step < ONBOARD_STEPS.length - 1 ? (
            <button className="btn-gold btn-sm" onClick={() => setStep(step + 1)}>Next</button>
          ) : (
            <button className="btn-gold btn-sm" onClick={onDismiss}>Let's go ⚡</button>
          )}
          <button className="btn-ghost btn-sm" onClick={onDismiss}>Skip</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Editor ─────────────────────────────────────────────────────────────
export default function LyricEditor({ videoFile, videoUrl, words: initWords, segments: initSegments, beats: initBeats, wolfColor, pack, meta, onClose, isMember }) {
  const [words, setWords] = useState(initWords)
  const [segments, setSegments] = useState(initSegments)
  const [beats] = useState(initBeats)
  const [style, setStyle] = useState(LYRIC_STYLES[0])
  const [beatFx, setBeatFx] = useState(true)
  const [beatEffect, setBeatEffect] = useState('flash')
  const [fontSize, setFontSize] = useState(48)
  const [position, setPosition] = useState('center')
  const [textColor, setTextColor] = useState('#ffffff')
  const [highlightColor, setHighlightColor] = useState(wolfColor || '#f5c518')
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [waveform, setWaveform] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportProg, setExportProg] = useState(0)
  const [editingLyrics, setEditingLyrics] = useState(false)
  const [lyricsText, setLyricsText] = useState('')
  const [editorTab, setEditorTab] = useState('style')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [bgType, setBgType] = useState('black') // black | color | image
  const [bgColor, setBgColor] = useState('#000000')
  const [bgImage, setBgImage] = useState(null)
  const [toasts, setToasts] = useState([])
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('lw_editor_onboarded'))

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const timelineRef = useRef(null)
  const bgInputRef = useRef(null)
  const themeColor = wolfColor || '#f5c518'

  const activeStyle = { ...style, size: fontSize, position, color: textColor, activeColor: highlightColor }

  function toast(msg, type = 'info') {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }

  function dismissOnboarding() {
    setShowOnboarding(false)
    localStorage.setItem('lw_editor_onboarded', '1')
  }

  // Load waveform
  useEffect(() => {
    if (!videoFile) return
    getWaveformData(videoFile, 300).then(w => { setWaveform(w); setDuration(w.duration) }).catch(() => toast('Could not analyze audio waveform', 'error'))
  }, [videoFile])

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')
    function frame() {
      const w = aspectRatio === '9:16' ? 720 : 1280
      const h = aspectRatio === '9:16' ? 1280 : 720
      canvas.width = w; canvas.height = h
      // Background
      if (bgType === 'color') { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, w, h) }
      else if (bgType === 'image' && bgImage) {
        // handled via CSS background on canvas container
        ctx.clearRect(0, 0, w, h)
      } else {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h)
      }
      setCurrentTime(video.currentTime)
      drawLyricFrame(ctx, w, h, video.currentTime, words, segments, activeStyle, themeColor, beats, beatFx)
      // Watermark for free users
      if (!isMember) {
        ctx.save()
        ctx.font = '14px Barlow Condensed'
        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.textAlign = 'right'
        ctx.fillText('Made with LW Studio ⚡', w - 12, h - 12)
        ctx.restore()
      }
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [words, segments, activeStyle, beats, beatFx, themeColor, aspectRatio, bgType, bgColor, bgImage, isMember])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onLoaded = () => setDuration(video.duration)
    video.addEventListener('play', onPlay); video.addEventListener('pause', onPause); video.addEventListener('loadedmetadata', onLoaded)
    return () => { video.removeEventListener('play', onPlay); video.removeEventListener('pause', onPause); video.removeEventListener('loadedmetadata', onLoaded) }
  }, [])

  function handleTimelineClick(e) {
    if (!timelineRef.current || !videoRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    videoRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  function openEditLyrics() {
    setLyricsText(segments.map(s => `${s.startTime.toFixed(1)}|${s.text}`).join('\n'))
    setEditingLyrics(true)
  }

  function saveLyrics() {
    const newSegs = lyricsText.split('\n').filter(l => l.trim()).map(line => {
      const [ts, ...rest] = line.split('|')
      return { startTime: parseFloat(ts) || 0, text: rest.join('|'), endTime: 0 }
    })
    for (let i = 0; i < newSegs.length - 1; i++) newSegs[i].endTime = newSegs[i + 1].startTime
    if (newSegs.length) newSegs[newSegs.length - 1].endTime = newSegs[newSegs.length - 1].startTime + 5
    setSegments(newSegs)
    setEditingLyrics(false)
    toast('Lyrics saved', 'success')
  }

  function handleBgUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setBgImage(url); setBgType('image')
    toast('Background uploaded', 'success')
  }

  async function handleExport() {
    if (!videoFile) return
    setExporting(true); setExportProg(0)
    toast('Starting export...', 'info')
    try {
      const { FFmpeg } = await import('https://esm.sh/@ffmpeg/ffmpeg@0.12.10')
      const { fetchFile, toBlobURL } = await import('https://esm.sh/@ffmpeg/util@0.12.1')
      const ffmpeg = new FFmpeg()
      setExportProg(5)
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
      await ffmpeg.load({ coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'), wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm') })
      setExportProg(15)
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile))
      setExportProg(25)
      const assContent = generateASS(words, segments, activeStyle, themeColor)
      await ffmpeg.writeFile('lyrics.ass', new TextEncoder().encode(assContent))
      setExportProg(30)
      ffmpeg.on('progress', ({ progress }) => setExportProg(30 + Math.floor(progress * 65)))
      await ffmpeg.exec(['-i', 'input.mp4', '-vf', 'ass=lyrics.ass', '-c:a', 'copy', '-preset', 'fast', 'output.mp4'])
      setExportProg(95)
      const outputData = await ffmpeg.readFile('output.mp4')
      const blob = new Blob([outputData.buffer], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${meta?.title || 'lyric-video'}.mp4`; a.click()
      URL.revokeObjectURL(url)
      setExportProg(100)
      toast('Video exported! Check your downloads.', 'success')
      setTimeout(() => { setExporting(false); setExportProg(0) }, 2000)
    } catch (err) {
      toast(`Export failed: ${err.message}`, 'error')
      setExporting(false); setExportProg(0)
    }
  }

  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className="le-fullscreen" style={{ '--le-color': themeColor }}>
      <ToastContainer toasts={toasts} />
      {showOnboarding && <OnboardingGuide onDismiss={dismissOnboarding} />}

      {/* Header */}
      <header className="le-header">
        <button className="btn-outline btn-sm" onClick={onClose}>← Back</button>
        <div className="le-header-title">
          <span className="le-title">{meta?.title || 'Lyric Video'}</span>
          <span className="le-artist">{meta?.artist || ''}</span>
        </div>
        <div className="le-header-actions">
          <div className="le-aspect-toggle">
            <button className={`le-aspect-btn${aspectRatio === '9:16' ? ' active' : ''}`} onClick={() => setAspectRatio('9:16')}>9:16</button>
            <button className={`le-aspect-btn${aspectRatio === '16:9' ? ' active' : ''}`} onClick={() => setAspectRatio('16:9')}>16:9</button>
          </div>
          <button className="btn-gold btn-sm" onClick={handleExport} disabled={exporting}>
            {exporting ? `${exportProg}%` : '⬇ Export'}
          </button>
        </div>
      </header>

      <div className="le-body">
        {/* Preview */}
        <div className="le-preview-col">
          <div className={`le-video-frame le-ratio-${aspectRatio.replace(':', 'x')}`} style={bgType === 'image' && bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
            <video ref={videoRef} src={videoUrl} className="le-video" playsInline style={{ opacity: bgType === 'black' && !videoUrl?.includes('video') ? 0 : 1 }} />
            <canvas ref={canvasRef} className="le-canvas" />
            <button className="le-play-btn" onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current.pause()}>
              {playing ? '⏸' : '▶'}
            </button>
          </div>
        </div>

        {/* Editor Panel */}
        <div className="le-editor-panel">
          <div className="le-tab-bar">
            {['style', 'customize', 'background'].map(t => (
              <button key={t} className={`le-tab-btn${editorTab === t ? ' active' : ''}`} onClick={() => setEditorTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}
          </div>

          <div className="le-tab-content">
            {/* STYLE TAB */}
            {editorTab === 'style' && (
              <>
                <h4 className="le-panel-title">Presets</h4>
                <div className="le-style-cards">
                  {LYRIC_STYLES.map(s => (
                    <button key={s.id} className={`le-style-card${style.id === s.id ? ' active' : ''}`} onClick={() => setStyle(s)}>
                      <div className="le-style-preview" style={{ fontFamily: s.font, fontSize: s.id === 'minimal' ? '0.9rem' : '1.2rem' }}>Aa</div>
                      <div className="le-style-label">{s.name}</div>
                    </button>
                  ))}
                </div>
                <h4 className="le-panel-title" style={{ marginTop: 16 }}>Beat Drop Effects</h4>
                <label className="le-toggle"><input type="checkbox" checked={beatFx} onChange={e => setBeatFx(e.target.checked)} /><span>Sync to beat drops</span></label>
                {beatFx && (
                  <div className="le-beat-fx-grid">
                    {BEAT_EFFECTS.map(fx => (
                      <button key={fx.id} className={`le-beat-fx-btn${beatEffect === fx.id ? ' active' : ''}`} onClick={() => setBeatEffect(fx.id)}>{fx.label}</button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* CUSTOMIZE TAB */}
            {editorTab === 'customize' && (
              <>
                <h4 className="le-panel-title">Font Size</h4>
                <div className="le-slider-row"><input type="range" min="16" max="96" value={fontSize} onChange={e => setFontSize(+e.target.value)} className="le-slider" /><span className="le-slider-val">{fontSize}px</span></div>

                <h4 className="le-panel-title">Position</h4>
                <div className="le-pos-btns">{POSITIONS.map(p => (<button key={p} className={`le-pos-btn${position === p ? ' active' : ''}`} onClick={() => setPosition(p)}>{p}</button>))}</div>

                <h4 className="le-panel-title">Colors</h4>
                <div className="le-color-row">
                  <label className="le-color-label">Text <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} /></label>
                  <label className="le-color-label">Highlight <input type="color" value={highlightColor} onChange={e => setHighlightColor(e.target.value)} /></label>
                </div>

                <h4 className="le-panel-title">Animation</h4>
                <div className="le-anim-btns">{ANIMATIONS.map(a => (<button key={a} className={`le-pos-btn${style.animation === a.toLowerCase() ? ' active' : ''}`} onClick={() => setStyle(s => ({ ...s, animation: a.toLowerCase() }))}>{a}</button>))}</div>
              </>
            )}

            {/* BACKGROUND TAB */}
            {editorTab === 'background' && (
              <>
                <h4 className="le-panel-title">Background</h4>
                <div className="le-bg-options">
                  <button className={`le-bg-opt${bgType === 'black' ? ' active' : ''}`} onClick={() => setBgType('black')}>Black</button>
                  <button className={`le-bg-opt${bgType === 'color' ? ' active' : ''}`} onClick={() => setBgType('color')}>Solid Color</button>
                  <button className={`le-bg-opt${bgType === 'image' ? ' active' : ''}`} onClick={() => bgInputRef.current?.click()}>Upload</button>
                </div>
                <input ref={bgInputRef} type="file" accept="image/*,video/*" hidden onChange={handleBgUpload} />
                {bgType === 'color' && (
                  <div className="le-color-row" style={{ marginTop: 8 }}>
                    <label className="le-color-label">Color <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} /></label>
                  </div>
                )}
                {bgImage && <button className="btn-ghost btn-sm" onClick={() => { setBgImage(null); setBgType('black') }} style={{ marginTop: 8 }}>Remove background</button>}
                <button className="btn-outline btn-sm le-ai-bg-btn" disabled style={{ marginTop: 12, opacity: 0.5 }}>Generate with AI (Coming Soon)</button>
              </>
            )}
          </div>

          <div className="le-panel-stats">
            <span>{words.length} words</span><span>{segments.length} lines</span><span>{beats.filter(b => b.isDrop).length} drops</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="le-timeline">
        <div className="le-timeline-tools">
          <button className="le-tool-btn" onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current.pause()}>{playing ? '⏸ Pause' : '▶ Play'}</button>
          <button className="le-tool-btn" onClick={openEditLyrics}>Edit Lyrics</button>
          <span className="le-time-display">{fmt(currentTime)} / {fmt(duration)}</span>
        </div>
        <div className="le-timeline-track" ref={timelineRef} onClick={handleTimelineClick}>
          {waveform && (
            <div className="le-waveform">
              {waveform.bars.map((h, i) => (
                <div key={i} className="le-wave-bar" style={{ height: `${h * 100}%`, background: (i / waveform.bars.length) * duration <= currentTime ? themeColor : 'var(--border)' }} />
              ))}
            </div>
          )}
          {beats.filter(b => b.isDrop).map((b, i) => (
            <div key={i} className="le-beat-marker" style={{ left: `${(b.time / (duration || 1)) * 100}%` }} />
          ))}
          <div className="le-word-track">
            {segments.map((seg, i) => {
              const left = (seg.startTime / (duration || 1)) * 100
              const width = ((seg.endTime - seg.startTime) / (duration || 1)) * 100
              return <div key={i} className="le-word-block" style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }} title={seg.text}>{seg.text.slice(0, 20)}</div>
            })}
          </div>
          <div className="le-playhead" style={{ left: `${playheadPct}%` }} />
        </div>
        {exporting && <div className="le-export-bar"><div className="le-export-fill" style={{ width: `${exportProg}%` }} /></div>}
      </div>

      {/* Edit Lyrics Modal */}
      {editingLyrics && (
        <div className="le-modal-overlay" onClick={() => setEditingLyrics(false)}>
          <div className="le-modal" onClick={e => e.stopPropagation()}>
            <h3 className="le-modal-title">Edit Lyrics</h3>
            <p className="le-modal-hint">Format: timestamp|text (one line each). Add new lines or adjust timing.</p>
            <textarea className="le-lyrics-textarea" value={lyricsText} onChange={e => setLyricsText(e.target.value)} rows={16} />
            <div className="le-modal-actions">
              <button className="btn-gold btn-sm" onClick={saveLyrics}>Save</button>
              <button className="btn-outline btn-sm" onClick={() => setEditingLyrics(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
