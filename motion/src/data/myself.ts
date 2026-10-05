// "Myself" (Lazy Jo, live) — word timings from the Studio demo template
// (client/src/data/demoTemplate.ts, Groq whisper-large-v3), cleaned up for
// on-screen display. The clip cuts off mid-word after "now you know", so
// the trailing fragments are dropped.

export type Word = { text: string; start: number; end: number };
export type CaptionLine = { first: number; last: number; start: number; end: number };
export type Giant = { text: string; start: number; end: number };

const raw: [string, number, number][] = [
  ["Got", 0, 0.26],
  ["myself", 0.26, 1.02],
  ["No,", 1.5, 2.6],
  ["I", 2.6, 2.74],
  ["don't", 2.74, 3.1],
  ["trust", 3.1, 3.48],
  ["anybody", 3.48, 4.72],
  ["but", 4.72, 5.8],
  ["myself", 5.8, 6.64],
  ["Yeah,", 6.98, 7.9],
  ["I", 7.9, 8.04],
  ["just", 8.04, 8.32],
  ["trust", 8.32, 8.68],
  ["my", 8.68, 9.06],
  ["myself", 9.06, 9.92],
  ["cuz", 9.92, 10.24],
  ["there's", 10.24, 10.42],
  ["no", 10.42, 10.6],
  ["one", 10.6, 10.76],
  ["like", 10.76, 11.02],
  ["me", 11.02, 11.58],
  ["or", 11.58, 11.78],
  ["maybe", 11.78, 12.08],
  ["there", 12.08, 12.42],
  ["is", 12.42, 12.72],
  ["but", 12.72, 12.96],
  ["I", 12.96, 13.18],
  ["can't", 13.18, 13.6],
  ["really", 13.6, 13.78],
  ["see", 13.78, 14.18],
  ["a", 14.18, 14.76],
  ["lot", 14.76, 15.04],
  ["of", 15.04, 15.28],
  ["folks", 15.28, 15.56],
  ["don't", 15.56, 15.92],
  ["want", 15.92, 16.14],
  ["to", 16.14, 16.28],
  ["see", 16.28, 16.44],
  ["you", 16.44, 16.72],
  ["win", 16.72, 16.96],
  ["and", 16.96, 17.26],
  ["when", 17.26, 17.5],
  ["you", 17.5, 17.76],
  ["do", 17.76, 17.94],
  ["they", 17.94, 18.14],
  ["will", 18.14, 18.3],
  ["try", 18.3, 18.46],
  ["to", 18.46, 18.6],
  ["make", 18.6, 18.88],
  ["it", 18.88, 19.02],
  ["to", 19.02, 19.4],
  ["leave", 19.4, 19.7],
  ["Lazy", 20.44, 20.72],
  ["Jo,", 20.72, 21.16],
  ["that's", 21.16, 21.28],
  ["my", 21.28, 21.56],
  ["name", 21.56, 21.82],
  ["if", 21.82, 22],
  ["you", 22, 22.14],
  ["didn't", 22.14, 22.36],
  ["know", 22.36, 22.86],
  ["now,", 22.86, 23.28],
  ["you", 23.28, 23.46],
  ["know", 23.46, 23.86],
];

export const WORDS: Word[] = raw.map(([text, start, end]) => ({ text, start, end }));

const line = (first: number, last: number, end?: number): CaptionLine => ({
  first,
  last,
  start: WORDS[first].start,
  end: end ?? WORDS[last].end + 0.35,
});

export const CAPTIONS: CaptionLine[] = [
  line(0, 1, 1.45),
  line(2, 6, 4.72),
  line(7, 8, 6.95),
  line(9, 14, 9.92),
  line(15, 20, 11.58),
  line(21, 24, 12.72),
  line(25, 29, 14.18),
  line(30, 39, 16.96),
  line(40, 43, 17.94),
  line(44, 51, 20.2),
  line(52, 60, 22.86),
];

// The one word per phrase that gets the full-width treatment.
export const GIANTS: Giant[] = [
  { text: "NO", start: 1.5, end: 2.74 },
  { text: "DON'T TRUST", start: 2.74, end: 3.48 },
  { text: "ANYBODY", start: 3.48, end: 4.72 },
  { text: "MYSELF", start: 5.8, end: 6.9 },
  { text: "YEAH", start: 6.98, end: 7.9 },
  { text: "TRUST", start: 8.32, end: 9.06 },
  { text: "MYSELF", start: 9.06, end: 9.92 },
  { text: "NO ONE", start: 10.42, end: 10.76 },
  { text: "LIKE ME", start: 10.76, end: 11.7 },
  { text: "MAYBE", start: 11.78, end: 12.72 },
  { text: "CAN'T SEE", start: 13.18, end: 14.3 },
  { text: "FOLKS", start: 15.28, end: 16.6 },
  { text: "WIN", start: 16.72, end: 17.9 },
  { text: "TRY", start: 18.3, end: 19.35 },
  { text: "LEAVE", start: 19.4, end: 20.1 },
];
