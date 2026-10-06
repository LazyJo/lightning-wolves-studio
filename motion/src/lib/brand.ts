export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const COLORS = {
  yellow: "#f5c518",
  yellowHot: "#ffd84a",
  amber: "#ff9d1c",
  black: "#050505",
  ink: "#0d0d0d",
  white: "#f7f4ea",
  // Poster series (2026 key art): cream "LAZY" + accent "JO".
  cream: "#efe6d2",
  lime: "#d4ff2a",
  red: "#e5161d",
  blue: "#1e5bff",
  navy: "#040a1c",
} as const;

export const FONTS = {
  display: "'Bebas Neue', 'Arial Narrow', sans-serif",
  poster: "'Anton', Impact, sans-serif",
  wide: "'Syncopate', 'Arial Black', sans-serif",
  body: "'Inter', 'Helvetica Neue', Arial, sans-serif",
} as const;

export const sec = (t: number) => Math.round(t * FPS);

// "Myself" (live clip) — measured with librosa: ~87 BPM, kick on the one
// every 2.755s starting at 0.86s. Every scene cut lands on DOWNBEATS.
export const BAR = 2.755;
export const BEAT = BAR / 4;
export const FIRST_DOWNBEAT = 0.86;
export const DOWNBEATS = Array.from({ length: 9 }, (_, i) => +(FIRST_DOWNBEAT + i * BAR).toFixed(3));
// [0.86, 3.615, 6.37, 9.125, 11.88, 14.635, 17.39, 20.145, 22.9]

// Detected low-end hits (kick/808) — drive the camera bumps.
export const KICKS = [
  0.86, 2.58, 3.11, 3.62, 4.64, 6.39, 8.1, 8.61, 11.89, 13.61, 14.14, 14.65, 15.7, 17.41, 19.13, 19.64, 20.18,
  21.2, 22.92,
];

export const SONG_DURATION = 24.02;
