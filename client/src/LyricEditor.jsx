import { useState, useEffect, useRef, useCallback } from 'react'
import { LYRIC_STYLES, detectBeats, drawLyricFrame, generateASS } from './LyricVideo'

// ─── Animation presets ───────────────────────────────────────────────────────
const ANIMATIONS = ['Slam', 'Fade', 'Glitch', 'Pop', 'Typewriter']
const POSITIONS = ['top', 'center', 'bottom']

// ─── Waveform drawer ─────────────────────────────────────────────────────────
async function getWaveformData(file, barCount = 200) {
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

// ─── LyricEditor Component ──────────────────────────────────────────────────
export default function LyricEditor({ videoFile, videoUrl, words: initWords, segments: initSegments, beats: initBeats, wolfColor, pack, meta, onClose }) {
  const [words, setWords] = useState(initWords)
  const [segments, setSegments] = useState(initSegments)
  const [beats] = useState(initBeats)
  const [style, setStyle] = useState(LYRIC_STYLES[0])
  const [beatFx, setBeatFx] = useState(true)
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

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const timelineRef = useRef(null)

  const themeColor = wolfColor || '#f5c518'

  // Build custom style from user settings
  const activeStyle = {
    ...style,
    size: fontSize,
    position,
    color: textColor,
    activeColor: highlightColor,
  }

  // Load waveform data
  useEffect(() => {
    if (!videoFile) return
    getWaveformData(videoFile, 300).then(w => { setWaveform(w); setDuration(w.duration) })
  }, [videoFile])

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')

    function frame() {
      canvas.width = video.videoWidth || 720
      canvas.height = video.videoHeight || 1280
      setCurrentTime(video.currentTime)
      drawLyricFrame(ctx, canvas.width, canvas.height, video.currentTime, words, segments, activeStyle, themeColor, beats, beatFx)
      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [words, segments, activeStyle, beats, beatFx, themeColor])

  // Video events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onLoaded = () => setDuration(video.duration)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('loadedmetadata', onLoaded)
    return () => { video.removeEventListener('play', onPlay); video.removeEventListener('pause', onPause); video.removeEventListener('loadedmetadata', onLoaded) }
  }, [])

  // Timeline click seek
  function handleTimelineClick(e) {
    if (!timelineRef.current || !videoRef.current) return
    const rect = timelineRef.current.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    videoRef.current.currentTime = pct * duration
  }

  // Edit lyrics modal
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
  }

  // Export
  async function handleExport() {
    if (!videoFile) return
    setExporting(true); setExportProg(0)
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
      setTimeout(() => { setExporting(false); setExportProg(0) }, 2000)
    } catch (err) {
      console.error('Export failed:', err)
      setExporting(false); setExportProg(0)
    }
  }

  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="le-fullscreen" style={{ '--le-color': themeColor }}>
      {/* Top bar */}
      <header className="le-header">
        <button className="btn-outline btn-sm" onClick={onClose}>← Back to Studio</button>
        <div className="le-header-title">
          <span className="le-title">{meta?.title || 'Lyric Video'}</span>
          <span className="le-artist">{meta?.artist || ''}</span>
        </div>
        <div className="le-header-actions">
          <button className="btn-gold btn-sm" onClick={handleExport} disabled={exporting}>
            {exporting ? `Exporting… ${exportProg}%` : '⬇ Export Video'}
          </button>
        </div>
      </header>

      <div className="le-body">
        {/* Video Preview (9:16 aspect) */}
        <div className="le-preview-col">
          <div className="le-video-frame">
            <video ref={videoRef} src={videoUrl} className="le-video" playsInline />
            <canvas ref={canvasRef} className="le-canvas" />
            <button className="le-play-btn" onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current.pause()}>
              {playing ? '⏸' : '▶'}
            </button>
          </div>
        </div>

        {/* Editor Panel */}
        <div className="le-editor-panel">
          <div className="le-panel-section">
            <h4 className="le-panel-title">Style</h4>
            <div className="le-style-cards">
              {LYRIC_STYLES.map(s => (
                <button key={s.id} className={`le-style-card${style.id === s.id ? ' active' : ''}`} onClick={() => setStyle(s)}>
                  <div className="le-style-preview" data-style={s.id}>Aa</div>
                  <div className="le-style-label">{s.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="le-panel-section">
            <h4 className="le-panel-title">Font Size</h4>
            <div className="le-slider-row">
              <input type="range" min="16" max="96" value={fontSize} onChange={e => setFontSize(+e.target.value)} className="le-slider" />
              <span className="le-slider-val">{fontSize}px</span>
            </div>
          </div>

          <div className="le-panel-section">
            <h4 className="le-panel-title">Position</h4>
            <div className="le-pos-btns">
              {POSITIONS.map(p => (
                <button key={p} className={`le-pos-btn${position === p ? ' active' : ''}`} onClick={() => setPosition(p)}>{p}</button>
              ))}
            </div>
          </div>

          <div className="le-panel-section">
            <h4 className="le-panel-title">Colors</h4>
            <div className="le-color-row">
              <label className="le-color-label">
                Text <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} />
              </label>
              <label className="le-color-label">
                Highlight <input type="color" value={highlightColor} onChange={e => setHighlightColor(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="le-panel-section">
            <label className="le-toggle">
              <input type="checkbox" checked={beatFx} onChange={e => setBeatFx(e.target.checked)} />
              <span>Beat Drop Effects</span>
            </label>
          </div>

          <div className="le-panel-section">
            <h4 className="le-panel-title">Stats</h4>
            <div className="le-stats-row">
              <span>{words.length} words</span>
              <span>{segments.length} lines</span>
              <span>{beats.filter(b => b.isDrop).length} drops</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="le-timeline">
        <div className="le-timeline-tools">
          <button className="le-tool-btn" onClick={openEditLyrics}>Edit Lyrics</button>
          <button className="le-tool-btn" onClick={() => videoRef.current && (videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause())}>
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <span className="le-time-display">{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>

        <div className="le-timeline-track" ref={timelineRef} onClick={handleTimelineClick}>
          {/* Waveform */}
          {waveform && (
            <div className="le-waveform">
              {waveform.bars.map((h, i) => (
                <div key={i} className="le-wave-bar" style={{ height: `${h * 100}%`, background: (i / waveform.bars.length) * duration <= currentTime ? themeColor : 'var(--border)' }}></div>
              ))}
            </div>
          )}

          {/* Beat markers */}
          {beats.filter(b => b.isDrop).map((b, i) => (
            <div key={i} className="le-beat-marker" style={{ left: `${(b.time / (duration || 1)) * 100}%` }}></div>
          ))}

          {/* Word blocks */}
          <div className="le-word-track">
            {segments.map((seg, i) => {
              const left = (seg.startTime / (duration || 1)) * 100
              const width = ((seg.endTime - seg.startTime) / (duration || 1)) * 100
              return (
                <div key={i} className="le-word-block" style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }} title={seg.text}>
                  {seg.text.slice(0, 20)}
                </div>
              )
            })}
          </div>

          {/* Playhead */}
          <div className="le-playhead" style={{ left: `${playheadPct}%` }}></div>
        </div>

        {exporting && (
          <div className="le-export-bar"><div className="le-export-fill" style={{ width: `${exportProg}%` }}></div></div>
        )}
      </div>

      {/* Edit Lyrics Modal */}
      {editingLyrics && (
        <div className="le-modal-overlay" onClick={() => setEditingLyrics(false)}>
          <div className="le-modal" onClick={e => e.stopPropagation()}>
            <h3 className="le-modal-title">Edit Lyrics</h3>
            <p className="le-modal-hint">Format: timestamp|text (one per line)</p>
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

function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
