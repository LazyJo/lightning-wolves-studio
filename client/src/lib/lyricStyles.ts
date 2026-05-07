// Lyric style presets — LYRC parity for the Remix picker.
//
// Each preset maps to render-pipeline parameters used by
// `assembleLyricVideo.ts` (drawtext / ASS karaoke / SRT fallback). The
// preview fields are also consumed by the Remix picker UI to show a small
// visual sample without rendering a video.
//
// drawtext is the primary overlay path and runs against ffmpeg.wasm's
// bundled Liberation Sans — custom fonts and italics need extra font
// assets we don't ship yet, so for now styles only differentiate by
// fill color, outline color, and size multiplier. The picker still
// shows italic / display-font previews; rendered output uses the same
// font for all presets but matches the color treatment.

export interface LyricStyleSpec {
  id: string;
  label: string;
  /** One-glyph teaser shown in the picker tile. */
  preview: string;
  /** CSS font for the picker preview (not used at render time). */
  font: string;
  /** Render: drawtext fontcolor + ASS PrimaryColour. Hex (#RRGGBB). */
  fillHex: string;
  /** Render: drawtext bordercolor + ASS OutlineColour. Hex (#RRGGBB). */
  outlineHex: string;
  /** Picker preview only — italic display sample. */
  italic?: boolean;
  /** Multiplier on the base font size at render time. 1.0 = default. */
  sizeMul: number;
  /** When true, skip the lyric overlay entirely at render time. */
  none?: boolean;
}

const GOLD = "#FACC15";
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const HOTPINK = "#E040FB";
const MINT = "#A0FFDC";

export const LYRIC_STYLES: LyricStyleSpec[] = [
  { id: "default", label: "Default", preview: "✦", font: "var(--font-body)",
    fillHex: GOLD, outlineHex: BLACK, sizeMul: 1.0 },
  { id: "none", label: "None", preview: "—", font: "var(--font-body)",
    fillHex: WHITE, outlineHex: BLACK, sizeMul: 1.0, none: true },
  { id: "heartless", label: "Heartless", preview: "THE", font: "var(--font-display)",
    fillHex: GOLD, outlineHex: BLACK, italic: true, sizeMul: 1.15 },
  { id: "fly", label: "Fly", preview: "THE", font: "var(--font-display)",
    fillHex: WHITE, outlineHex: BLACK, sizeMul: 1.0 },
  { id: "pikachu", label: "Pikachu", preview: "THE QUICK", font: "var(--font-display)",
    fillHex: GOLD, outlineHex: BLACK, sizeMul: 0.9 },
  { id: "wave", label: "Wave", preview: "THE QUICK", font: "var(--font-heading)",
    fillHex: WHITE, outlineHex: BLACK, sizeMul: 0.9 },
  { id: "hotpink", label: "HOTPINK", preview: "THE", font: "var(--font-display)",
    fillHex: HOTPINK, outlineHex: BLACK, sizeMul: 1.0 },
  { id: "brat", label: "Brat", preview: "the quick", font: "var(--font-body)",
    fillHex: MINT, outlineHex: BLACK, sizeMul: 0.85 },
];

export function getLyricStyle(id: string | undefined): LyricStyleSpec {
  if (!id) return LYRIC_STYLES[0];
  return LYRIC_STYLES.find((s) => s.id === id) || LYRIC_STYLES[0];
}

/** Convert "#RRGGBB" to ASS "&H00BBGGRR" (BGR-ordered, alpha 00 = opaque). */
export function hexToAssBgr(hex: string): string {
  const m = hex.replace("#", "").match(/^([0-9a-fA-F]{6})$/);
  if (!m) return "&H00FFFFFF";
  const rr = m[1].slice(0, 2);
  const gg = m[1].slice(2, 4);
  const bb = m[1].slice(4, 6);
  return `&H00${bb}${gg}${rr}`.toUpperCase();
}
