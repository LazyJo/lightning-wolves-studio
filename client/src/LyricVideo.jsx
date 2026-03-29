// ─── Lyric Video Utilities (used by StudioPage) ─────────────────────────────
// Exports: LYRIC_STYLES, detectBeats, drawLyricFrame, generateASS

// ─── Lyric Styles ────────────────────────────────────────────────────────────
export const LYRIC_STYLES = [
  { id: 'karaoke', name: 'Karaoke', desc: 'Words highlight as sung', font: 'Bebas Neue', size: 48, position: 'center', color: '#ffffff', activeColor: null, animation: 'highlight' },
  { id: 'pop', name: 'Pop', desc: 'Bold words slam in', font: 'Bebas Neue', size: 64, position: 'center', color: null, activeColor: '#ffffff', animation: 'slam' },
  { id: 'subtitle', name: 'Subtitle', desc: 'Clean bottom subtitles', font: 'Barlow Condensed', size: 32, position: 'bottom', color: '#ffffff', activeColor: null, animation: 'fade' },
  { id: 'glitch', name: 'Glitch', desc: 'Glitch distortion effect', font: 'Bebas Neue', size: 52, position: 'center', color: '#ffffff', activeColor: null, animation: 'glitch' },
  { id: 'minimal', name: 'Minimal', desc: 'Soft elegant fade', font: 'Barlow Condensed', size: 28, position: 'lower-third', color: '#cccccc', activeColor: null, animation: 'softfade' },
]

// ─── Beat Detection (Web Audio API) ──────────────────────────────────────────
export async function detectBeats(file) {
  const audioCtx = new AudioContext()
  const arrayBuf = await file.arrayBuffer()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuf)

  const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate)
  const source = offlineCtx.createBufferSource()
  source.buffer = audioBuffer
  const filter = offlineCtx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 150
  source.connect(filter)
  filter.connect(offlineCtx.destination)
  source.start(0)

  const rendered = await offlineCtx.startRendering()
  const data = rendered.getChannelData(0)
  const sampleRate = rendered.sampleRate
  const windowSize = Math.floor(sampleRate * 0.05)
  const hopSize = Math.floor(windowSize / 2)
  const energies = []

  for (let i = 0; i < data.length - windowSize; i += hopSize) {
    let energy = 0
    for (let j = 0; j < windowSize; j++) energy += data[i + j] * data[i + j]
    energies.push({ time: i / sampleRate, energy: energy / windowSize })
  }

  const beats = []
  const lookback = 20
  for (let i = lookback; i < energies.length; i++) {
    let localAvg = 0
    for (let j = i - lookback; j < i; j++) localAvg += energies[j].energy
    localAvg /= lookback
    if (energies[i].energy > localAvg * 1.8 && energies[i].energy > 0.001) {
      const t = energies[i].time
      if (beats.length === 0 || t - beats[beats.length - 1].time > 0.3) {
        beats.push({ time: t, energy: energies[i].energy })
      }
    }
  }

  await audioCtx.close()
  const maxEnergy = Math.max(...beats.map(b => b.energy), 0.001)
  return beats.map(b => ({ time: b.time, intensity: b.energy / maxEnergy, isDrop: b.energy / maxEnergy > 0.7 }))
}

// ─── Canvas Renderer ─────────────────────────────────────────────────────────
export function drawLyricFrame(ctx, width, height, currentTime, words, segments, style, wolfColor, beats, beatEffectsOn) {
  ctx.clearRect(0, 0, width, height)
  const color = style.color || wolfColor
  const activeColor = style.activeColor || wolfColor

  // Beat drop flash
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
    const currentSeg = segments.find((s, i) => { const next = segments[i + 1]; return currentTime >= s.startTime && (!next || currentTime < next.startTime) })
    if (!currentSeg) return
    const lineWords = words.filter(w => w.start >= currentSeg.startTime && w.start < (currentSeg.endTime || currentSeg.startTime + 5))
    if (!lineWords.length) return
    ctx.font = `${style.size}px '${style.font}'`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const fullText = lineWords.map(w => w.word).join(' ')
    const totalWidth = ctx.measureText(fullText).width
    let x = (width - totalWidth) / 2
    lineWords.forEach(w => {
      const wordText = w.word + ' '
      const ww = ctx.measureText(wordText).width
      const isActive = currentTime >= w.start && currentTime <= w.end
      ctx.fillStyle = isActive ? activeColor : color
      ctx.globalAlpha = isActive ? 1 : 0.6
      ctx.shadowBlur = isActive ? 12 : 0
      ctx.shadowColor = activeColor
      ctx.fillText(wordText, x + ww / 2, height / 2)
      x += ww
    })
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  } else if (style.animation === 'slam' && words.length > 0) {
    const currentWord = [...words].reverse().find(w => currentTime >= w.start)
    if (!currentWord) return
    const progress = Math.min((currentTime - currentWord.start) / 0.3, 1)
    const scale = 1 + (1 - progress) * 0.5
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
    const currentWord = [...words].reverse().find(w => currentTime >= w.start)
    if (!currentWord) return
    const age = currentTime - currentWord.start
    const glitchAmount = age < 0.15 ? (1 - age / 0.15) * 8 : 0
    ctx.font = `bold ${style.size}px '${style.font}'`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (glitchAmount > 0) {
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
    const currentSeg = segments.find((s, i) => { const next = segments[i + 1]; return currentTime >= s.startTime && (!next || currentTime < next.startTime) })
    if (!currentSeg) return
    const segAge = currentTime - currentSeg.startTime
    const alpha = Math.min(segAge / 0.5, 1) * Math.max(1 - (segAge - 3) / 0.5, 0)
    ctx.font = `300 ${style.size}px '${style.font}'`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = style.color || '#cccccc'
    ctx.globalAlpha = Math.max(alpha, 0)
    ctx.fillText(currentSeg.text, width / 2, height * 0.75)
    ctx.globalAlpha = 1
  } else {
    // SUBTITLE
    const currentSeg = segments.find((s, i) => { const next = segments[i + 1]; return currentTime >= s.startTime && (!next || currentTime < next.startTime) })
    if (!currentSeg) return
    const segAge = currentTime - currentSeg.startTime
    ctx.font = `${style.size}px '${style.font}'`
    ctx.textAlign = 'center'
    const textW = ctx.measureText(currentSeg.text).width
    const y = height - 60
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect((width - textW) / 2 - 16, y - style.size / 2 - 8, textW + 32, style.size + 16)
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = Math.min(segAge / 0.3, 1)
    ctx.fillText(currentSeg.text, width / 2, y)
    ctx.globalAlpha = 1
  }
}

// ─── ASS Subtitle Generator ──────────────────────────────────────────────────
export function generateASS(words, segments, style, wolfColor) {
  const hexToASS = (hex) => { const r = hex.slice(1, 3), g = hex.slice(3, 5), b = hex.slice(5, 7); return `&H00${b}${g}${r}&` }
  const color = hexToASS(style.color || wolfColor)
  const activeColor = hexToASS(style.activeColor || wolfColor)
  const alignment = style.position === 'bottom' ? 2 : style.position === 'lower-third' ? 2 : 5

  let ass = `[Script Info]\nTitle: Lyric Video\nScriptType: v4.00+\nPlayResX: 1280\nPlayResY: 720\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,${style.size},${color},${activeColor},&H00000000&,&H80000000&,-1,0,0,0,100,100,0,0,1,2,1,${alignment},30,30,40,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`

  segments.forEach(seg => {
    const start = secsToASSTime(seg.startTime)
    const end = secsToASSTime(seg.endTime)
    ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${seg.text}\n`
  })
  return ass
}

function secsToASSTime(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60), cs = Math.floor((secs % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
