import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

export interface AssembleArgs {
  ffmpeg: FFmpeg;
  clipUrls: string[];        // Generated scene clips, in playback order
  audioFile: File;           // The user's original song audio
  srt: string;               // SRT subtitle text (from /api/generate)
  aspectRatio?: "9:16" | "16:9";
  onStage?: (stage: string) => void;
}

// Target canvas sizes — keep it reasonable for browser memory.
const CANVAS = {
  "9:16": { w: 720, h: 1280 },
  "16:9": { w: 1280, h: 720 },
} as const;

/**
 * Takes a list of generated scene clip URLs + the original audio + the SRT
 * and assembles them into one finished lyric video inside the browser via
 * ffmpeg.wasm.
 *
 * Pipeline:
 *   1. Fetch every clip + the audio + write the srt into the ffmpeg FS.
 *   2. Normalise each clip to the same codec/size/fps so `concat` works
 *      without re-encoding surprises.
 *   3. Concatenate normalised clips into one video track.
 *   4. Mix in the user's audio, overlay subtitles from the SRT.
 *   5. Export as MP4 and return as a Blob URL.
 *
 * ~15-30 seconds of output on a modern laptop lands in 60-90s of real
 * ffmpeg time. Heavy, but it all stays on the user's machine.
 */
export async function assembleLyricVideo({
  ffmpeg,
  clipUrls,
  audioFile,
  srt,
  aspectRatio = "9:16",
  onStage,
}: AssembleArgs): Promise<string> {
  const { w, h } = CANVAS[aspectRatio];
  const fps = 30;
  const log = (s: string) => onStage?.(s);

  if (clipUrls.length === 0) {
    throw new Error("No clips provided to assemble.");
  }

  // ── 1. Write inputs into ffmpeg's virtual FS ──────────────────────────
  log("Downloading generated clips…");
  for (let i = 0; i < clipUrls.length; i++) {
    const name = `scene${i}.mp4`;
    const data = await fetchFile(clipUrls[i]);
    await ffmpeg.writeFile(name, data);
  }

  log("Loading audio…");
  await ffmpeg.writeFile("song.audio", new Uint8Array(await audioFile.arrayBuffer()));
  await ffmpeg.writeFile("subs.srt", new TextEncoder().encode(srt || ""));

  // ── 2. Normalise each clip to the same spec ──────────────────────────
  // Different models output different resolutions + fps; concat's demuxer
  // needs identical streams. We re-encode each to H.264 @ canvas size.
  log("Normalising clip sizes…");
  for (let i = 0; i < clipUrls.length; i++) {
    const input = `scene${i}.mp4`;
    const output = `norm${i}.mp4`;
    await ffmpeg.exec([
      "-i", input,
      "-vf", `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=${fps}`,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-pix_fmt", "yuv420p",
      "-an",  // strip any source audio — we'll mix our own
      output,
    ]);
  }

  // ── 3. Concatenate normalised clips into one silent video ────────────
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

  // ── 4. Mix in audio + burn in subtitles ──────────────────────────────
  log("Adding audio + lyrics…");
  const hasSubs = (srt || "").trim().length > 0;
  const subsFilter = hasSubs
    ? `subtitles=subs.srt:force_style='FontName=Arial,FontSize=18,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=60'`
    : null;

  const args = [
    "-i", "silent.mp4",
    "-i", "song.audio",
  ];
  if (subsFilter) {
    args.push("-vf", subsFilter);
  }
  args.push(
    "-c:v", subsFilter ? "libx264" : "copy",
    "-preset", "ultrafast",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-shortest",  // cut off when whichever stream ends first
    "-movflags", "+faststart",
    "final.mp4"
  );
  await ffmpeg.exec(args);

  // ── 5. Pull the result out ───────────────────────────────────────────
  log("Finalising…");
  const out = await ffmpeg.readFile("final.mp4");
  const blob = new Blob([out as Uint8Array], { type: "video/mp4" });
  return URL.createObjectURL(blob);
}
