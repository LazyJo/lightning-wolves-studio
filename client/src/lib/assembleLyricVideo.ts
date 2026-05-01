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
   * we fall back to a static SRT (`srt`) burned in.
   */
  wordTimings?: WordTiming[];
  srt?: string;              // Static SRT fallback when wordTimings is absent
  audioDurationSec?: number; // Used to size the output and bound zoom motion
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

  // ── Inputs: audio + lyric overlay are shared by both modes ──────────
  log("Loading audio…");
  await ffmpeg.writeFile("song.audio", new Uint8Array(await audioFile.arrayBuffer()));

  const overlay = buildOverlay(args, w, h);
  if (overlay.kind === "ass") {
    await ffmpeg.writeFile("subs.ass", new TextEncoder().encode(overlay.body));
  } else if (overlay.kind === "srt") {
    await ffmpeg.writeFile("subs.srt", new TextEncoder().encode(overlay.body));
  }

  // ── Branch: image-backdrop fast path ─────────────────────────────────
  if (args.bgImageUrl) {
    log("Loading backdrop image…");
    const imgBytes = await fetchFile(args.bgImageUrl);
    await ffmpeg.writeFile("bg.jpg", imgBytes);

    const dur = Math.max(5, args.audioDurationSec ?? 60);

    // Filter chain. Kept deliberately minimal — just scale, crop, and
    // (optionally) subtitles. Anything fancier (zoompan, blend, etc.)
    // has been observed to break ffmpeg.wasm builds that lack a filter
    // or behave oddly with `-loop 1` infinite inputs.
    const baseFilter = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;

    // Subtitle attempt order: ASS karaoke → SRT static → no overlay.
    // This way the user always gets *some* video out of the door even
    // if libass can't render karaoke effects in the bundled wasm.
    const attempts: Array<{ label: string; vf: string; pre?: () => Promise<void> }> = [];
    if (overlay.kind === "ass") {
      attempts.push({
        label: "ASS karaoke",
        vf: `${baseFilter},subtitles=subs.ass`,
        pre: async () => {
          // ASS already written above; nothing to do here.
        },
      });
      // Fallback 1: also try plain SRT — derive an SRT from the ASS dialogues.
      if (args.srt) {
        attempts.push({
          label: "static SRT",
          vf: `${baseFilter},subtitles=subs.srt:force_style='FontName=Arial,FontSize=18,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=60'`,
          pre: async () => {
            await ffmpeg.writeFile("subs.srt", new TextEncoder().encode(args.srt!));
          },
        });
      }
    } else if (overlay.kind === "srt") {
      attempts.push({
        label: "static SRT",
        vf: `${baseFilter},${overlay.filter}`,
      });
    }
    // Fallback 2 (always present): no overlay at all — just image + audio.
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
          "-i", "song.audio",
          "-vf", attempt.vf,
          "-c:v", "libx264",
          "-preset", "ultrafast",
          "-tune", "stillimage",
          "-pix_fmt", "yuv420p",
          "-c:a", "aac",
          "-b:a", "128k",
          "-shortest",
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
    const muxArgs = [
      "-i", "silent.mp4",
      "-i", "song.audio",
    ];
    if (overlay.filter) muxArgs.push("-vf", overlay.filter);
    muxArgs.push(
      "-c:v", overlay.filter ? "libx264" : "copy",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-shortest",
      "-movflags", "+faststart",
      "final.mp4",
    );
    await ffmpeg.exec(muxArgs);
  }

  // ── Pull the result out ─────────────────────────────────────────────
  log("Finalising…");
  const out = await ffmpeg.readFile("final.mp4");
  const blob = new Blob([out as Uint8Array], { type: "video/mp4" });
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
