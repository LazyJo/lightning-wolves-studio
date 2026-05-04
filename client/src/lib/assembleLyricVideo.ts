import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import type { WordTiming } from "./templates";

export interface AssembleArgs {
  ffmpeg: FFmpeg;
  /**
   * Backdrop source. Choose ONE:
   *  - `bgImageUrl`  → fast path: a single still image is looped to song length
   *                    with a slow ken-burns zoom. Used for preset scenes
   *                    (the curated /scenes/<id>.jpg thumbnails).
   *  - `clipUrls`    → AI path: pre-rendered video clips are stitched
   *                    end-to-end. Used for Custom prompts that ran through
   *                    Replicate.
   */
  bgImageUrl?: string;
  clipUrls?: string[];
  audioFile: File;           // The user's original song audio
  /**
   * Word-level timings for karaoke-style word highlighting. When omitted,
   * we fall back to a static SRT (`srt`) burned in. Times are CLIP-relative
   * (i.e. start at 0 for the picked clip window) so they line up with the
   * trimmed audio below.
   */
  wordTimings?: WordTiming[];
  srt?: string;              // Static SRT fallback when wordTimings is absent
  audioDurationSec?: number; // Used to size the output and bound zoom motion
  /**
   * Clip window inside the source song. When set, the audio is trimmed to
   * `[clipStart, clipStart+clipDuration]` and the visual is bounded to
   * `clipDuration` so the output covers ONLY the picked slice — not the
   * full song. Required to fix the "whole-song output" bug Jo flagged on
   * 2026-05-03; without it Scenes/Remix/Performance all default to the
   * full audio length.
   */
  clipStart?: number;
  clipDuration?: number;
  aspectRatio?: "9:16" | "16:9";
  onStage?: (stage: string) => void;
}

// Target canvas sizes — keep it reasonable for browser memory.
const CANVAS = {
  "9:16": { w: 720, h: 1280 },
  "16:9": { w: 1280, h: 720 },
} as const;

/**
 * Browser-side ffmpeg pipeline that turns a backdrop + the user's song +
 * lyric timings into a finished MP4. Two modes share the same audio + lyric
 * overlay logic but differ in how the visual track is built:
 *
 *   • Image mode (bgImageUrl): loop a still as a ken-burns video for the
 *     full song. Sub-15s render — used for the curated preset library so
 *     "pick a scene → see your lyric video" feels instant.
 *   • Clip mode (clipUrls): stitch pre-rendered clips end-to-end. Used for
 *     Custom AI scenes where we have actual generated motion.
 *
 * Lyric overlay always uses ASS karaoke (`\kf` per word) when wordTimings
 * is provided so the active word fills with brand gold as it's sung —
 * matches LYRC's word-by-word reveal. When timings aren't available we
 * fall back to a plain SRT burn.
 */
export async function assembleLyricVideo(args: AssembleArgs): Promise<string> {
  const { ffmpeg, audioFile, aspectRatio = "9:16", onStage } = args;
  const { w, h } = CANVAS[aspectRatio];
  const fps = 30;
  const log = (s: string) => onStage?.(s);

  if (!args.bgImageUrl && (!args.clipUrls || args.clipUrls.length === 0)) {
    throw new Error("No backdrop provided to assemble.");
  }

  // ── Resolve the clip window the output should cover ────────────────
  // If the caller passed clipDuration, render only that slice. Otherwise
  // fall back to audioDurationSec, otherwise to a sane minimum. This is
  // what makes Scenes/Remix/Performance honour the user's picked window
  // instead of always rendering the whole song.
  const clipStart = Math.max(0, args.clipStart ?? 0);
  const clipDuration = (() => {
    if (typeof args.clipDuration === "number" && args.clipDuration > 0) return args.clipDuration;
    if (typeof args.audioDurationSec === "number" && args.audioDurationSec > 0) return args.audioDurationSec;
    return 15;
  })();
  const dur = Math.max(2, clipDuration);

  // ── Inputs: audio + lyric overlay are shared by both modes ──────────
  log("Loading audio…");
  // Preserve the source extension so ffmpeg.wasm's libavformat can probe
  // the container (mp3 / m4a / wav / webm). A previous attempt wrote the
  // audio to "song.audio" with no extension and tried to pre-trim it via
  // a separate ffmpeg.exec call to "song.clip.audio" — that produced
  // ErrnoError: FS error in Scenes because libavformat couldn't pick a
  // muxer for the extension-less output. Now we write to song.<ext> and
  // do the trim INLINE on the final command via -ss / -t before -i, which
  // is faster and dodges the muxer-guess problem entirely.
  const ext = (() => {
    const name = audioFile.name || "";
    const dot = name.lastIndexOf(".");
    if (dot > 0) return name.slice(dot + 1).toLowerCase();
    if (audioFile.type.includes("mpeg") || audioFile.type.includes("mp3")) return "mp3";
    if (audioFile.type.includes("wav")) return "wav";
    if (audioFile.type.includes("ogg")) return "ogg";
    if (audioFile.type.includes("webm")) return "webm";
    if (audioFile.type.includes("mp4") || audioFile.type.includes("m4a")) return "m4a";
    return "mp3"; // safe default — server-side audio is usually mp3.
  })();
  const audioPath = `song.${ext}`;
  await ffmpeg.writeFile(audioPath, new Uint8Array(await audioFile.arrayBuffer()));

  // Audio-input flags applied to the final ffmpeg.exec in each branch:
  // -ss before -i = fast input seek (start of clip window),
  // -t after the seek bounds the input duration to clipDuration.
  const audioInputArgs = (clipStart > 0 || dur < (args.audioDurationSec ?? Infinity))
    ? ["-ss", String(clipStart), "-t", String(dur), "-i", audioPath]
    : ["-i", audioPath];

  const overlay = buildOverlay(args, w, h);
  // For "drawtext" we also write subs.ass — it's our ASS-karaoke fallback
  // body, used if drawtext somehow fails. SRT body always lives in args.srt
  // and is written lazily by the SRT attempt's pre() hook.
  if (overlay.kind === "ass" || overlay.kind === "drawtext") {
    await ffmpeg.writeFile("subs.ass", new TextEncoder().encode(overlay.body));
  } else if (overlay.kind === "srt") {
    await ffmpeg.writeFile("subs.srt", new TextEncoder().encode(overlay.body));
  }

  // ── Branch: image-backdrop fast path ─────────────────────────────────
  if (args.bgImageUrl) {
    log("Loading backdrop image…");
    const imgBytes = await fetchFile(args.bgImageUrl);
    await ffmpeg.writeFile("bg.jpg", imgBytes);

    // Ken-Burns zoompan: render the still image as a slowly-zooming video
    // so output reads as motion rather than a frozen frame (the "it's just
    // an image" complaint Jo flagged 2026-05-03). zoompan rebuilds frames
    // from a still input and is supported in the standard ffmpeg.wasm
    // single-thread build. Use a high upscale (2400×) before zoompan so
    // the zoomed frame still has detail, then crop to canvas.
    const totalFrames = Math.max(2, Math.round(dur * fps));
    const baseFilter = [
      `scale=2400:-1:flags=lanczos`,
      `zoompan=z='min(zoom+0.0010,1.20)':d=${totalFrames}:s=${w}x${h}:fps=${fps}`,
      `crop=${w}:${h}`,
    ].join(",");

    // Overlay attempt order: drawtext per-word → ASS karaoke → SRT → none.
    // drawtext is primary because it works without libass + font lookup,
    // which was failing silently and leaving exports with no lyrics.
    const attempts: Array<{ label: string; vf: string; pre?: () => Promise<void> }> = [];
    if (overlay.kind === "drawtext") {
      attempts.push({ label: "drawtext per-word", vf: `${baseFilter},${overlay.filter}` });
      // Keep ASS as a backup so the karaoke effect is still available
      // wherever libass + fonts happen to work.
      attempts.push({
        label: "ASS karaoke",
        vf: `${baseFilter},subtitles=subs.ass`,
      });
    } else if (overlay.kind === "ass") {
      attempts.push({
        label: "ASS karaoke",
        vf: `${baseFilter},subtitles=subs.ass`,
      });
    }
    if (overlay.kind !== "none" && args.srt) {
      attempts.push({
        label: "static SRT",
        vf: `${baseFilter},subtitles=subs.srt:force_style='FontName=Arial,FontSize=18,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=60'`,
        pre: async () => {
          await ffmpeg.writeFile("subs.srt", new TextEncoder().encode(args.srt!));
        },
      });
    } else if (overlay.kind === "srt") {
      attempts.push({
        label: "static SRT",
        vf: `${baseFilter},${overlay.filter}`,
      });
    }
    // Last resort: no overlay at all — just image + audio.
    attempts.push({ label: "no overlay", vf: baseFilter });

    let lastErr: unknown = null;
    for (const attempt of attempts) {
      try {
        if (attempt.pre) await attempt.pre();
        log(`Rendering lyric video (${attempt.label})…`);
        await ffmpeg.exec([
          "-loop", "1",
          "-framerate", String(fps),
          "-t", String(dur),
          "-i", "bg.jpg",
          ...audioInputArgs,
          "-vf", attempt.vf,
          "-c:v", "libx264",
          "-preset", "ultrafast",
          // Drop the stillimage tune — incompatible with zoompan motion.
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "128k",
          "-shortest",
          "-t", String(dur), // hard output cap — belt-and-suspenders for -shortest
          "-movflags", "+faststart",
          "final.mp4",
        ]);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        // Surface attempt failure but keep going through the fallback chain.
        // eslint-disable-next-line no-console
        console.warn(`assembleLyricVideo: '${attempt.label}' attempt failed`, e);
      }
    }
    if (lastErr) throw lastErr;
  } else {
    // ── Clip-stitch path (AI Custom flow) ──────────────────────────────
    const clipUrls = args.clipUrls!;
    log("Downloading generated clips…");
    for (let i = 0; i < clipUrls.length; i++) {
      const data = await fetchFile(clipUrls[i]);
      await ffmpeg.writeFile(`scene${i}.mp4`, data);
    }

    log("Normalising clip sizes…");
    for (let i = 0; i < clipUrls.length; i++) {
      await ffmpeg.exec([
        "-i", `scene${i}.mp4`,
        "-vf", `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=${fps}`,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-an",
        `norm${i}.mp4`,
      ]);
    }

    log("Stitching scenes…");
    const concatList = clipUrls.map((_, i) => `file 'norm${i}.mp4'`).join("\n");
    await ffmpeg.writeFile("concat.txt", new TextEncoder().encode(concatList));
    await ffmpeg.exec([
      "-f", "concat",
      "-safe", "0",
      "-i", "concat.txt",
      "-c", "copy",
      "silent.mp4",
    ]);

    log("Adding audio + lyrics…");
    // Overlay attempt order matches the image path: drawtext per-word →
    // ASS karaoke → SRT → none. drawtext is primary so Remix exports
    // actually carry lyrics even when libass + font search fails inside
    // ffmpeg.wasm (Jo's "no lyrics" bug, 2026-05-04).
    const attempts: Array<{ label: string; vf: string | null; pre?: () => Promise<void> }> = [];
    if (overlay.kind === "drawtext") {
      attempts.push({ label: "drawtext per-word", vf: overlay.filter });
      attempts.push({ label: "ASS karaoke", vf: "subtitles=subs.ass" });
    } else if (overlay.kind === "ass") {
      attempts.push({ label: "ASS karaoke", vf: "subtitles=subs.ass" });
    }
    if (overlay.kind !== "none" && args.srt) {
      attempts.push({
        label: "static SRT",
        vf: "subtitles=subs.srt:force_style='FontName=Arial,FontSize=18,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=60'",
        pre: async () => {
          await ffmpeg.writeFile("subs.srt", new TextEncoder().encode(args.srt!));
        },
      });
    } else if (overlay.kind === "srt") {
      attempts.push({ label: "static SRT", vf: overlay.filter });
    }
    attempts.push({ label: "no overlay", vf: null });

    let lastErr: unknown = null;
    for (const attempt of attempts) {
      try {
        if (attempt.pre) await attempt.pre();
        const args2: string[] = [
          "-i", "silent.mp4",
          ...audioInputArgs,
        ];
        if (attempt.vf) args2.push("-vf", attempt.vf);
        // Always re-encode the video stream — `-c:v copy` makes ffmpeg.wasm
        // ignore -shortest in some 0.12.x builds, which is exactly the
        // "Remix exports the whole song" bug Jo flagged 2026-05-03 even
        // after the audio was trimmed correctly. libx264 + an explicit
        // output-side -t guarantees the file is exactly clipDuration.
        args2.push(
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "128k",
          "-shortest",
          "-t", String(dur),
          "-movflags", "+faststart",
          "final.mp4",
        );
        await ffmpeg.exec(args2);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        // eslint-disable-next-line no-console
        console.warn(`assembleLyricVideo: '${attempt.label}' attempt failed`, e);
      }
    }
    if (lastErr) throw lastErr;
  }

  // ── Pull the result out ─────────────────────────────────────────────
  log("Finalising…");
  const out = await ffmpeg.readFile("final.mp4");
  const blob = new Blob([out as BlobPart], { type: "video/mp4" });
  return URL.createObjectURL(blob);
}

/* ─── Overlay builder ───────────────────────────────────────────────── */

interface OverlaySpec {
  kind: "ass" | "srt" | "none";
  body: string;
  filter: string; // ffmpeg -vf fragment, "" if no overlay
}

function buildOverlay(args: AssembleArgs, w: number, h: number): OverlaySpec {
  if (args.wordTimings && args.wordTimings.length > 0) {
    return {
      kind: "ass",
      body: buildKaraokeAss(args.wordTimings, w, h),
      filter: "ass=subs.ass",
    };
  }
  if (args.srt && args.srt.trim().length > 0) {
    return {
      kind: "srt",
      body: args.srt,
      filter: "subtitles=subs.srt:force_style='FontName=Arial,FontSize=18,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=60'",
    };
  }
  return { kind: "none", body: "", filter: "" };
}

/**
 * Build an ASS subtitle file with `\kf` (fill) karaoke effect — each word
 * fills with brand gold as it's sung, with the still-unsung words rendered
 * in white. Lines are grouped into ~4-word phrases for readability.
 *
 * Color encoding gotcha: ASS uses `&H00BBGGRR` (BGR-ordered, not RGB).
 *   gold #facc15 → BGR 15CCFA → &H0015CCFA
 *   white        → &H00FFFFFF
 */
function buildKaraokeAss(words: WordTiming[], width: number, height: number): string {
  const wordsPerLine = 4;
  const lines: WordTiming[][] = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine));
  }

  const dialogues = lines.map((line) => {
    const start = formatAssTime(line[0].start);
    const end = formatAssTime(line[line.length - 1].end);
    const text = line
      .map((w) => {
        const dur = Math.max(1, Math.round((w.end - w.start) * 100));
        return `{\\kf${dur}}${escapeAssText(w.word)} `;
      })
      .join("")
      .trim();
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  });

  // Font + margin scale with canvas height so 9:16 and 16:9 read the same.
  const fontSize = Math.max(36, Math.round(height * 0.058));
  const marginV = Math.round(height * 0.12);
  const outline = Math.max(2, Math.round(fontSize / 18));

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    `Style: Default,Arial,${fontSize},&H0015CCFA,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,${outline},2,2,40,40,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
    ...dialogues,
    "",
  ].join("\n");
}

function formatAssTime(secs: number): string {
  const safe = Math.max(0, secs);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe - h * 3600 - m * 60;
  return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\n/g, "\\N");
}
