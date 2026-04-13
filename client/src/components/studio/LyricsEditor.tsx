import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock, Globe, Keyboard, Check, X, Play, Pause, ArrowDown,
  RotateCcw, Edit3, ChevronDown,
} from "lucide-react";

interface WordBlock {
  word: string;
  start?: number;
  end?: number;
}

interface LyricsBlock {
  words: WordBlock[];
  startTime: number;
}

interface Props {
  lyrics: string;
  segments?: { start: number; end: number; text: string }[];
  audioUrl?: string;
  language: string;
  onDone: (editedLyrics: string, blocks: LyricsBlock[]) => void;
  onRetranscribe?: (language: string) => void;
  accentColor?: string;
}

const LANGUAGES = [
  { code: "auto", label: "Auto-detect", flag: "🌐" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "nl", label: "Dutch", flag: "🇳🇱" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "ko", label: "Korean", flag: "🇰🇷" },
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
];

export default function LyricsEditor({
  lyrics,
  segments,
  audioUrl,
  language,
  onDone,
  onRetranscribe,
  accentColor = "#9b6dff",
}: Props) {
  // Parse lyrics into blocks
  const [blocks, setBlocks] = useState<LyricsBlock[]>(() => {
    if (segments?.length) {
      return segments.map((seg) => ({
        words: seg.text.trim().split(/\s+/).map((w) => ({ word: w })),
        startTime: seg.start,
      }));
    }
    const lines = lyrics.split("\n").filter(Boolean);
    return lines.map((line, i) => ({
      words: line.trim().split(/\s+/).map((w) => ({ word: w })),
      startTime: i * 3,
    }));
  });

  const [mode, setMode] = useState<"edit" | "retime" | "language" | "manual">("edit");
  const [editingWord, setEditingWord] = useState<{ blockIdx: number; wordIdx: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [retimeIndex, setRetimeIndex] = useState(0);
  const [retimeBlockIdx, setRetimeBlockIdx] = useState(0);
  const [selectedLang, setSelectedLang] = useState(language === "French" ? "fr" : language === "Dutch" ? "nl" : language === "Spanish" ? "es" : "auto");
  const [manualText, setManualText] = useState(lyrics);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const totalWords = blocks.reduce((sum, b) => sum + b.words.length, 0);

  // Focus edit input when editing a word
  useEffect(() => {
    if (editingWord && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingWord]);

  // Audio time tracking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => setCurrentTime(audio.currentTime);
    audio.addEventListener("timeupdate", update);
    return () => audio.removeEventListener("timeupdate", update);
  }, [audioUrl]);

  // Re-Time keyboard listener
  useEffect(() => {
    if (mode !== "retime") return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        const time = audioRef.current?.currentTime || 0;

        // Find the current word across all blocks
        let wordCount = 0;
        for (let bi = 0; bi < blocks.length; bi++) {
          for (let wi = 0; wi < blocks[bi].words.length; wi++) {
            if (wordCount === retimeIndex) {
              setBlocks((prev) => {
                const next = [...prev];
                next[bi] = { ...next[bi], words: [...next[bi].words] };
                next[bi].words[wi] = { ...next[bi].words[wi], start: time };
                if (wi === 0) next[bi].startTime = time;
                return next;
              });
              setRetimeIndex((i) => i + 1);
              return;
            }
            wordCount++;
          }
        }
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mode, retimeIndex, blocks]);

  const startWord = useCallback((blockIdx: number, wordIdx: number) => {
    const word = blocks[blockIdx].words[wordIdx].word;
    setEditingWord({ blockIdx, wordIdx });
    setEditValue(word);
  }, [blocks]);

  const saveWord = useCallback(() => {
    if (!editingWord) return;
    setBlocks((prev) => {
      const next = [...prev];
      next[editingWord.blockIdx] = {
        ...next[editingWord.blockIdx],
        words: [...next[editingWord.blockIdx].words],
      };
      next[editingWord.blockIdx].words[editingWord.wordIdx] = {
        ...next[editingWord.blockIdx].words[editingWord.wordIdx],
        word: editValue,
      };
      return next;
    });
    setEditingWord(null);
  }, [editingWord, editValue]);

  const handleDone = useCallback(() => {
    const text = blocks.map((b) => b.words.map((w) => w.word).join(" ")).join("\n");
    onDone(text, blocks);
  }, [blocks, onDone]);

  const startRetime = useCallback(() => {
    setMode("retime");
    setRetimeIndex(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const stopRetime = useCallback(() => {
    setMode("edit");
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleManualSubmit = useCallback(() => {
    const lines = manualText.split("\n").filter(Boolean);
    setBlocks(
      lines.map((line, i) => ({
        words: line.trim().split(/\s+/).map((w) => ({ word: w })),
        startTime: i * 3,
      }))
    );
    setMode("edit");
  }, [manualText]);

  const handleRetranscribe = useCallback(() => {
    if (onRetranscribe) {
      onRetranscribe(selectedLang === "auto" ? "English" : LANGUAGES.find((l) => l.code === selectedLang)?.label || "English");
    }
    setMode("edit");
  }, [selectedLang, onRetranscribe]);

  // Get the "coming up" word for retime mode
  const getRetimeWord = (offset: number) => {
    let count = 0;
    for (const block of blocks) {
      for (const w of block.words) {
        if (count === retimeIndex + offset) return w.word;
        count++;
      }
    }
    return "";
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.floor((s % 1) * 10))}`;

  return (
    <div className="space-y-4">
      {/* Hidden audio */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} />}

      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border border-purple-500/20 bg-purple-500/5 p-3">
        <div className="flex items-center gap-2">
          <Edit3 size={16} className="text-purple-400" />
          <div>
            <p className="text-sm font-semibold text-white">Edit Lyrics</p>
            <p className="text-[10px] text-wolf-muted">{totalWords} words · {blocks.length} blocks</p>
          </div>
        </div>
        <button onClick={() => setMode("edit")} className="text-wolf-muted hover:text-white">
          <X size={14} />
        </button>
      </div>

      {/* Info banner */}
      <div className="rounded-lg border border-wolf-gold/15 bg-wolf-gold/5 px-3 py-2 text-[10px] text-wolf-gold">
        Perfect your lyrics once — they'll be saved for all future videos
      </div>

      <AnimatePresence mode="wait">
        {/* ── EDIT MODE ── */}
        {mode === "edit" && (
          <motion.div
            key="edit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-h-[300px] space-y-3 overflow-y-auto pr-1"
          >
            {blocks.map((block, bi) => (
              <div key={bi} className="rounded-xl border border-wolf-border/10 bg-wolf-surface/30 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-wolf-muted">
                    Block {bi + 1}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: accentColor }}>
                    {formatTime(block.startTime)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {block.words.map((w, wi) => (
                    editingWord?.blockIdx === bi && editingWord?.wordIdx === wi ? (
                      <input
                        key={wi}
                        ref={editInputRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveWord}
                        onKeyDown={(e) => { if (e.key === "Enter") saveWord(); if (e.key === "Escape") setEditingWord(null); }}
                        className="rounded border border-purple-500/40 bg-purple-500/10 px-2 py-1 text-xs text-white outline-none"
                        style={{ width: `${Math.max(editValue.length * 8 + 16, 40)}px` }}
                      />
                    ) : (
                      <button
                        key={wi}
                        onClick={() => startWord(bi, wi)}
                        className="rounded bg-wolf-border/20 px-2 py-1 text-xs text-white transition-all hover:bg-purple-500/20 hover:text-purple-300"
                      >
                        {w.word}
                      </button>
                    )
                  ))}
                </div>
                {/* Scroll to next block arrow */}
                {bi < blocks.length - 1 && (
                  <div className="mt-2 flex justify-center">
                    <ChevronDown size={14} style={{ color: accentColor }} className="opacity-30" />
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}

        {/* ── RE-TIME MODE ── */}
        {mode === "retime" && (
          <motion.div
            key="retime"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-purple-500/20 bg-wolf-surface/30 p-6 text-center"
          >
            {/* Coming up preview */}
            <p className="mb-1 text-[10px] uppercase tracking-[0.3em] text-wolf-muted">Coming Up</p>
            <motion.p
              key={retimeIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-1 text-3xl font-bold text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {getRetimeWord(0) || "Done!"}
            </motion.p>
            <p className="mb-6 text-sm text-wolf-muted">{getRetimeWord(1)}</p>

            {/* Progress */}
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-wolf-border/20">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(retimeIndex / totalWords) * 100}%`,
                  background: `linear-gradient(90deg, ${accentColor}, #f5c518)`,
                }}
              />
            </div>
            <p className="mb-4 text-[10px] text-wolf-muted">
              {retimeIndex} / {totalWords} words timed
            </p>

            {/* Tap instruction */}
            <div className="mb-4 rounded-xl border border-wolf-border/20 bg-wolf-card px-4 py-3">
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-white">Tap</span>
                <span className="rounded border border-wolf-border/30 bg-wolf-surface px-2 py-0.5 text-xs text-wolf-muted">
                  <ArrowDown size={12} className="inline" /> Space
                </span>
                <span className="text-sm text-white">when each word starts</span>
              </div>
              <p className="mt-1 text-[10px] text-wolf-muted">Hold the key for longer words</p>
            </div>

            {retimeIndex >= totalWords ? (
              <button
                onClick={stopRetime}
                className="w-full rounded-xl bg-green-500 py-3 font-bold text-black"
              >
                <Check size={14} className="mr-2 inline" /> Timing Complete!
              </button>
            ) : (
              <button
                onClick={stopRetime}
                className="w-full rounded-xl border border-wolf-border/30 py-2 text-sm text-wolf-muted hover:text-white"
              >
                Cancel Re-Time
              </button>
            )}
          </motion.div>
        )}

        {/* ── WRONG LANGUAGE MODE ── */}
        {mode === "language" && (
          <motion.div
            key="language"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-wolf-border/20 bg-wolf-surface/30 p-4"
          >
            <div className="mb-4 flex items-center gap-2">
              <Globe size={16} className="text-wolf-muted" />
              <span className="text-sm font-semibold text-white">Select Language</span>
              <button onClick={() => setMode("edit")} className="ml-auto text-wolf-muted hover:text-white">
                <X size={14} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-1.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLang(lang.code)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-all ${
                    selectedLang === lang.code
                      ? "border border-purple-500/30 bg-purple-500/10 text-white"
                      : "text-wolf-muted hover:bg-white/5"
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleRetranscribe}
              className="w-full rounded-xl py-2.5 font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${accentColor}, #f5c518)` }}
            >
              <RotateCcw size={14} className="mr-2 inline" /> Re-transcribe
            </button>
          </motion.div>
        )}

        {/* ── MANUAL INPUT MODE ── */}
        {mode === "manual" && (
          <motion.div
            key="manual"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-wolf-border/20 bg-wolf-surface/30 p-4"
          >
            <div className="mb-3 flex items-center gap-2">
              <Keyboard size={16} className="text-wolf-muted" />
              <div>
                <p className="text-sm font-semibold text-white">Manual Lyrics Input</p>
                <p className="text-[10px] text-wolf-muted">Paste your full lyrics below. We'll space them evenly for you to adjust.</p>
              </div>
              <button onClick={() => setMode("edit")} className="ml-auto text-wolf-muted hover:text-white">
                <X size={14} />
              </button>
            </div>

            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Paste your lyrics here..."
              rows={8}
              className="mb-4 w-full resize-none rounded-lg border border-wolf-border/20 bg-wolf-card p-3 text-sm text-white placeholder:text-wolf-muted/40 focus:border-purple-500/30 focus:outline-none"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setMode("edit")}
                className="flex-1 rounded-xl border border-wolf-border/30 py-2.5 text-sm text-wolf-muted hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleManualSubmit}
                className="flex-1 rounded-xl py-2.5 font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${accentColor}, #f5c518)` }}
              >
                <Check size={14} className="mr-2 inline" /> Use these lyrics
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom action bar ── */}
      {mode === "edit" && (
        <div className="flex items-center gap-2 rounded-xl border border-wolf-border/10 bg-wolf-card p-2">
          <button
            onClick={startRetime}
            className="flex items-center gap-1.5 rounded-lg border border-wolf-border/20 px-3 py-2 text-xs font-medium text-wolf-muted transition-all hover:bg-white/5 hover:text-white"
          >
            <Clock size={13} /> Re-Time
          </button>
          <button
            onClick={() => setMode("language")}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-wolf-muted transition-all hover:bg-white/5 hover:text-white"
          >
            <Globe size={13} /> Wrong language?
          </button>
          <button
            onClick={() => setMode("manual")}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-wolf-muted transition-all hover:bg-white/5 hover:text-white"
          >
            <Keyboard size={13} /> Re-enter manually
          </button>
          <div className="flex-1" />
          <button
            onClick={handleDone}
            className="rounded-lg px-5 py-2 text-xs font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${accentColor}, #7c3aed)` }}
          >
            <Check size={13} className="mr-1.5 inline" /> Done
          </button>
        </div>
      )}
    </div>
  );
}
