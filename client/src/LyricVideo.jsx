import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Lyric Styles ────────────────────────────────────────────────────────────
const LYRIC_STYLES = [
  {
    id: 'karaoke',
    name: 'Karaoke',
    desc: 'Words highlight one by one as sung',
    font: 'Bebas Neue',
    size: 48,
    position: 'center',
    color: '#ffffff',
    activeColor: null, // uses wolf color
    animation: 'highlight',
  },
  {
    id: 'pop',
    name: 'Pop',
    desc: 'Bold words slam in, then fade',
    font: 'Bebas Neue',
    size: 64,
    position: 'center',
    color: null, // uses wolf color
    activeColor: '#ffffff',
    animation: 'slam',
  },
  {
    id: 'subtitle',
    name: 'Subtitle',
    desc: 'Clean bottom subtitles, line by line',
    font: 'Barlow Condensed',
    size: 32,
    position: 'bottom',
    color: '#ffffff',
    activeColor: null,
    animation: 'fade',
  },
  {
    id: 'glitch',
    name: 'Glitch',
    desc: 'Words appear with glitch distortion',
    font: 'Bebas Neue',
    size: 52,
    position: 'center',
    color: '#ffffff',
    activeColor: null,
    animation: 'glitch',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    desc: 'Small elegant text, soft fade',
    font: 'Barlow Condensed',
    size: 28,
    position: 'lower-third',
    color: '#cccccc',
    activeColor: null,
    animation: 'softfade',
  },
]

// ─── Beat Detection (Web Audio API) ──────────────────────────────────────────
async function detectBeats(audioBuffer) {
  const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate)
  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer

  // Low-pass filter to isolate bass/kick
  const filter = offlineCtx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 150

  source.connect(filter)
  filter.connect(offlineCtx.destination)
  source.start(0)

  const rendered = await offlineCtx.startRendering()
  const data = rendered.getChannelData(0)

  // Compute energy in windows
  const sampleRate = rendered.sampleRate
  const windowSize = Math.floor(sampleRate * 0.05) // 50ms windows
  const hopSize = Math.floor(windowSize / 2)
  const energies = []

  for (let i = 0; i < data.length - windowSize; i += hopSize) {
    let energy = 0
    for (let j = 0; j < windowSize; j++) {
      energy += data[i + j] * data[i + j]
    }
    energies.push({ time: i / sampleRate, energy: energy / windowSize })
  }

  // Find peaks (energy > 1.8x local average)
  const beats = []
  const lookback = 20
  const minGap = 0.3 // minimum 300ms between beats

  for (let i = lookback; i < energies.length; i++) {
    let localAvg = 0
    for (let j = i - lookback; j < i; j++) localAvg += energies[j].energy
    localAvg /= lookback

    if (energies[i].energy > localAvg * 1.8 && energies[i].energy > 0.001) {
      const t = energies[i].time
      if (beats.length === 0 || t - beats[beats.length - 1].time > minGap) {
        beats.push({ time: t, energy: energies[i].energy })
      }
    }
  }

  // Normalize and pick top energy moments as "drops"
  const maxEnergy = Math.max(...beats.map(b => b.energy), 0.001)
  return beats.map(b => ({
    time: b.time,
    intensity: b.energy / maxEnergy,
    isDrop: b.energy / maxEnergy > 0.7,
  }))
}

// ─── Canvas Renderer ─────────────────────────────────────────────────────────
function drawLyricFrame(ctx, width, height, currentTime, words, segments, style, wolfColor, beats, beatEffectsOn) {
  ctx.clearRect(0, 0, width, height)

  const color = style.color || wolfColor
  const activeColor = style.activeColor || wolfColor

  // Beat drop effect
  if (beatEffectsOn && beats.length > 0) {
    const nearBeat = beats.find(b => Math.abs(b.time - currentTime) < 0.08 && b.isDrop)
    if (nearBeat) {
      ctx.save()
      ctx.fillStyle = wolfColor
      ctx.globalAlpha = nearBeat.intensity * 0.15
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }
  }

  if (style.animation === 'highlight' && words.length > 0) {
    // KARAOKE: show current line, highlight active word
    const currentSeg = segments.find((s, i) => {
      const next = segments[i + 1]
      return currentTime >= s.startTime && (!next || currentTime < next.startTime)
    })
    if (!currentSeg) return

    const lineWords = words.filter(w => w.start >= currentSeg.startTime && w.start < (currentSeg.endTime || currentSeg.startTime + 5))
    if (!lineWords.length) return

    ctx.font = `${style.size}px '${style.font}'`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const y = height / 2
    const fullText = lineWords.map(w => w.word).join(' ')
    const totalWidth = ctx.measureText(fullText).width
    let x = (width - totalWidth) / 2

    lineWords.forEach(w => {
      const wordText = w.word + ' '
      const ww = ctx.measureText(wordText).width
      const isActive = currentTime >= w.start && currentTime <= w.end
      ctx.fillStyle = isActive ? activeColor : color
      ctx.globalAlpha = isActive ? 1 : 0.6
      if (isActive) {
        ctx.shadowBlur = 12
        ctx.shadowColor = activeColor
      } else {
        ctx.shadowBlur = 0
      }
      ctx.fillText(wordText, x + ww / 2, y)
      x += ww
    })
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1

  } else if (style.animation === 'slam' && words.length > 0) {
    // POP: current word slams in big and centered
    const currentWord = [...words].reverse().find(w => currentTime >= w.start)
    if (!currentWord) return

    const progress = Math.min((currentTime - currentWord.start) / 0.3, 1)
    const scale = 1 + (1 - progress) * 0.5 // start big, settle
    const alpha = Math.min(progress * 3, 1) * Math.max(1 - (currentTime - currentWord.end) / 0.3, 0.3)

    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.scale(scale, scale)
    ctx.font = `bold ${style.size}px '${style.font}'`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color || wolfColor
    ctx.globalAlpha = Math.max(alpha, 0)
    ctx.shadowBlur = 16
    ctx.shadowColor = wolfColor
    ctx.fillText(currentWord.word, 0, 0)
    ctx.restore()

  } else if (style.animation === 'glitch' && words.length > 0) {
    // GLITCH: current word with offset color channels
    const currentWord = [...words].reverse().find(w => currentTime >= w.start)
    if (!currentWord) return

    const age = currentTime - currentWord.start
    const glitchAmount = age < 0.15 ? (1 - age / 0.15) * 8 : 0

    ctx.font = `bold ${style.size}px '${style.font}'`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (glitchAmount > 0) {
      // Red channel offset
      ctx.save()
      ctx.globalAlpha = 0.6
      ctx.fillStyle = '#ff0040'
      ctx.fillText(currentWord.word, width / 2 - glitchAmount, height / 2 - glitchAmount / 2)
      ctx.fillStyle = '#00ffff'
      ctx.fillText(currentWord.word, width / 2 + glitchAmount, height / 2 + glitchAmount / 2)
      ctx.restore()
    }

    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = 1
    ctx.fillText(currentWord.word, width / 2, height / 2)

  } else if (style.animation === 'softfade') {
    // MINIMAL: soft fade line
    const currentSeg = segments.find((s, i) => {
      const next = segments[i + 1]
      return currentTime >= s.startTime && (!next || currentTime < next.startTime)
    })
    if (!currentSeg) return

    const segAge = currentTime - currentSeg.startTime
    const alpha = Math.min(segAge / 0.5, 1) * Math.max(1 - (segAge - 3) / 0.5, 0)

    ctx.font = `300 ${style.size}px '${style.font}'`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = style.color || '#cccccc'
    ctx.globalAlpha = Math.max(alpha, 0)
    const y = style.position === 'lower-third' ? height * 0.75 : height * 0.85
    ctx.fillText(currentSeg.text, width / 2, y)
    ctx.globalAlpha = 1

  } else {
    // SUBTITLE: line by line at bottom
    const currentSeg = segments.find((s, i) => {
      const next = segments[i + 1]
      return currentTime >= s.startTime && (!next || currentTime < next.startTime)
    })
    if (!currentSeg) return

    const segAge = currentTime - currentSeg.startTime
    const alpha = Math.min(segAge / 0.3, 1)

    // Background bar
    ctx.font = `${style.size}px '${style.font}'`
    ctx.textAlign = 'center'
    const textW = ctx.measureText(currentSeg.text).width
    const y = height - 60
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect((width - textW) / 2 - 16, y - style.size / 2 - 8, textW + 32, style.size + 16)

    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = alpha
    ctx.fillText(currentSeg.text, width / 2, y)
    ctx.globalAlpha = 1
  }
}

// ─── LyricVideo Component ────────────────────────────────────────────────────
export default function LyricVideo({ wolfColor }) {
  const [step, setStep] = useState('upload') // upload | processing | preview | export
  const [videoFile, setVideoFile] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [words, setWords] = useState([])
  const [segments, setSegments] = useState([])
  const [beats, setBeats] = useState([])
  const [selectedStyle, setSelectedStyle] = useState(LYRIC_STYLES[0])
  const [beatEffects, setBeatEffects] = useState(true)
  const [processing, setProcessing] = useState('')
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const fileInputRef = useRef(null)

  const themeColor = wolfColor || '#f5c518'

  // Cleanup video URL on unmount
  useEffect(() => {
    return () => { if (videoUrl) URL.revokeObjectURL(videoUrl) }
  }, [videoUrl])

  // ── Upload handler ──
  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setError('Please upload a video file (mp4, webm, etc.)')
      return
    }
    if (file.size > 200 * 1024 * 1024) {
      setError('File too large (max 200 MB)')
      return
    }
    setError('')
    setVideoFile(file)
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoUrl(URL.createObjectURL(file))
  }

  // ── Process: transcribe + beat detect ──
  async function handleProcess() {
    if (!videoFile) return
    setStep('processing')
    setError('')

    try {
      // Transcribe
      setProcessing('Transcribing audio...')
      const fd = new FormData()
      fd.append('file', videoFile)
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Transcription failed')

      const wordData = (data.words || []).map(w => ({
        word: w.word?.trim(),
        start: w.start,
        end: w.end,
      })).filter(w => w.word)

      // Build segments from transcriptLines with numeric timestamps
      const segData = (data.transcriptLines || []).map(line => {
        const parts = line.ts.split(':')
        const startTime = parseInt(parts[0]) * 60 + parseInt(parts[1])
        return { text: line.text, startTime, endTime: startTime + 4 }
      })

      // Fix segment endTimes
      for (let i = 0; i < segData.length - 1; i++) {
        segData[i].endTime = segData[i + 1].startTime
      }

      setWords(wordData)
      setSegments(segData)

      // Beat detection
      setProcessing('Analyzing beats...')
      const audioCtx = new AudioContext()
      const arrayBuf = await videoFile.arrayBuffer()
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuf)
      const detectedBeats = await detectBeats(audioBuffer)
      setBeats(detectedBeats)
      await audioCtx.close()

      setProcessing('')
      setStep('preview')
    } catch (err) {
      setError(err.message)
      setStep('upload')
      setProcessing('')
    }
  }

  // ── Canvas animation loop ──
  useEffect(() => {
    if (step !== 'preview' || !canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const video = videoRef.current

    function frame() {
      if (video.paused && !video.seeking) {
        animRef.current = requestAnimationFrame(frame)
        return
      }
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      drawLyricFrame(ctx, canvas.width, canvas.height, video.currentTime, words, segments, selectedStyle, themeColor, beats, beatEffects)
      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [step, words, segments, selectedStyle, themeColor, beats, beatEffects])

  // ── Export with FFmpeg.wasm ──
  async function handleExport() {
    if (!videoFile || !canvasRef.current || !videoRef.current) return
    setExporting(true)
    setExportProgress(0)
    setError('')

    try {
      // Dynamic import FFmpeg
      const { FFmpeg } = await import('https://esm.sh/@ffmpeg/ffmpeg@0.12.10')
      const { fetchFile, toBlobURL } = await import('https://esm.sh/@ffmpeg/util@0.12.1')

      const ffmpeg = new FFmpeg()
      setExportProgress(5)

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      setExportProgress(15)

      // Write input video
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile))
      setExportProgress(25)

      // Generate ASS subtitle file from lyrics
      const assContent = generateASS(words, segments, selectedStyle, themeColor)
      const encoder = new TextEncoder()
      await ffmpeg.writeFile('lyrics.ass', encoder.encode(assContent))
      setExportProgress(30)

      // Burn subtitles into video
      ffmpeg.on('progress', ({ progress }) => {
        setExportProgress(30 + Math.floor(progress * 65))
      })

      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vf', `ass=lyrics.ass`,
        '-c:a', 'copy',
        '-preset', 'fast',
        'output.mp4'
      ])
      setExportProgress(95)

      const outputData = await ffmpeg.readFile('output.mp4')
      const blob = new Blob([outputData.buffer], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)

      // Download
      const a = document.createElement('a')
      a.href = url
      a.download = `lyric-video-${Date.now()}.mp4`
      a.click()
      URL.revokeObjectURL(url)

      setExportProgress(100)
      setTimeout(() => { setExporting(false); setExportProgress(0) }, 2000)
    } catch (err) {
      setError(`Export failed: ${err.message}`)
      setExporting(false)
      setExportProgress(0)
    }
  }

  // ── Reset ──
  function handleReset() {
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    setVideoFile(null)
    setVideoUrl(null)
    setWords([])
    setSegments([])
    setBeats([])
    setStep('upload')
    setError('')
    setProcessing('')
  }

  return (
    <div className="lyric-video-page" style={{ '--lv-color': themeColor }}>

      {/* ── UPLOAD STEP ── */}
      {step === 'upload' && (
        <div className="lv-upload-area">
          <div className="lv-upload-hero">
            <div className="lv-upload-icon">🎬</div>
            <h2 className="lv-title">Lyric Video Creator</h2>
            <p className="lv-subtitle">Upload a video, get lyrics synced with beats. Pick a style. Export.</p>
          </div>

          <div className="lv-upload-zone" onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" accept="video/*" hidden onChange={handleFileSelect} />
            {videoFile ? (
              <div className="lv-file-ready">
                <div className="lv-file-icon">✓</div>
                <div className="lv-file-name">{videoFile.name}</div>
                <div className="lv-file-size">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</div>
              </div>
            ) : (
              <>
                <div className="lv-drop-icon">⬆️</div>
                <div className="lv-drop-text">Drop a video file or click to browse</div>
                <div className="lv-drop-sub">MP4, WebM · max 200 MB</div>
              </>
            )}
          </div>

          {videoFile && (
            <button className="btn-gold lv-process-btn" onClick={handleProcess}>
              ⚡ Analyze & Transcribe
            </button>
          )}
        </div>
      )}

      {/* ── PROCESSING STEP ── */}
      {step === 'processing' && (
        <div className="lv-processing">
          <div className="lv-spinner"></div>
          <div className="lv-processing-text">{processing}</div>
        </div>
      )}

      {/* ── PREVIEW STEP ── */}
      {step === 'preview' && (
        <div className="lv-preview-layout">
          {/* Video + Canvas overlay */}
          <div className="lv-player-wrap">
            <video
              ref={videoRef}
              src={videoUrl}
              className="lv-video"
              controls
              playsInline
            />
            <canvas ref={canvasRef} className="lv-canvas-overlay" />
          </div>

          {/* Controls sidebar */}
          <div className="lv-controls">
            <h3 className="lv-controls-title">Lyric Style</h3>
            <div className="lv-style-grid">
              {LYRIC_STYLES.map(s => (
                <button
                  key={s.id}
                  className={`lv-style-card${selectedStyle.id === s.id ? ' active' : ''}`}
                  onClick={() => setSelectedStyle(s)}
                >
                  <div className="lv-style-name">{s.name}</div>
                  <div className="lv-style-desc">{s.desc}</div>
                </button>
              ))}
            </div>

            <div className="lv-toggle-row">
              <label className="lv-toggle-label">
                <input
                  type="checkbox"
                  checked={beatEffects}
                  onChange={e => setBeatEffects(e.target.checked)}
                />
                <span>Beat Drop Effects</span>
              </label>
              <span className="lv-beat-count">{beats.filter(b => b.isDrop).length} drops detected</span>
            </div>

            <div className="lv-stats">
              <div className="lv-stat"><span className="lv-stat-num">{words.length}</span> words</div>
              <div className="lv-stat"><span className="lv-stat-num">{segments.length}</span> lines</div>
              <div className="lv-stat"><span className="lv-stat-num">{beats.length}</span> beats</div>
            </div>

            <div className="lv-actions">
              <button className="btn-gold lv-export-btn" onClick={handleExport} disabled={exporting}>
                {exporting ? `Exporting... ${exportProgress}%` : '⬇ Export Video'}
              </button>
              <button className="btn-outline lv-reset-btn" onClick={handleReset}>Start Over</button>
            </div>

            {exporting && (
              <div className="lv-progress-bar">
                <div className="lv-progress-fill" style={{ width: `${exportProgress}%` }}></div>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="lv-error">{error}</div>}
    </div>
  )
}

// ─── ASS Subtitle Generator (for FFmpeg export) ──────────────────────────────
function generateASS(words, segments, style, wolfColor) {
  const hexToASS = (hex) => {
    // ASS uses &HBBGGRR& format
    const r = hex.slice(1, 3)
    const g = hex.slice(3, 5)
    const b = hex.slice(5, 7)
    return `&H00${b}${g}${r}&`
  }

  const color = hexToASS(style.color || wolfColor)
  const activeColor = hexToASS(style.activeColor || wolfColor)
  const fontSize = style.size
  const fontName = style.font === 'Bebas Neue' ? 'Arial' : 'Arial' // fallback for FFmpeg

  const alignment = style.position === 'bottom' ? 2 : style.position === 'lower-third' ? 2 : 5 // 5=center, 2=bottom-center

  let ass = `[Script Info]
Title: Lyric Video
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${color},${activeColor},&H00000000&,&H80000000&,-1,0,0,0,100,100,0,0,1,2,1,${alignment},30,30,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  // Use segments for subtitle-style export
  segments.forEach(seg => {
    const start = secsToASSTime(seg.startTime)
    const end = secsToASSTime(seg.endTime)
    ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${seg.text}\n`
  })

  return ass
}

function secsToASSTime(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  const cs = Math.floor((secs % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
