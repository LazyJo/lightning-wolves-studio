---
name: Lightning Wolves Studio
description: An artist-run home for a pack of real independent artists — calm black, rare gold.
colors:
  night-black: "#0a0a0c"
  graphite-surface: "#111115"
  smoked-card: "#18181f"
  iron-border: "#2a2a35"
  moon-white: "#f0f0f4"
  dusk-lavender: "#8888aa"
  lightning-gold: "#f5c518"
  gold-shadow: "#b8940f"
  ember-amber: "#e8870a"
  scenes-green: "#69f0ae"
  performance-magenta: "#E040FB"
  cover-cyan: "#22d3ee"
  hub-violet: "#9b6dff"
typography:
  display:
    fontFamily: "Syncopate, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.05em"
  headline:
    fontFamily: "Syncopate, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0.05em"
  numeral:
    fontFamily: "Bebas Neue, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 400
    lineHeight: 1
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.lightning-gold}"
    textColor: "{colors.night-black}"
    rounded: "{rounded.lg}"
    padding: "14px 32px"
  button-primary-hover:
    backgroundColor: "{colors.ember-amber}"
    textColor: "{colors.night-black}"
  button-secondary:
    backgroundColor: "{colors.night-black}"
    textColor: "{colors.moon-white}"
    rounded: "{rounded.lg}"
    padding: "14px 32px"
  nav-pill:
    backgroundColor: "{colors.graphite-surface}"
    textColor: "{colors.moon-white}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  chip:
    backgroundColor: "{colors.smoked-card}"
    textColor: "{colors.dusk-lavender}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  card:
    backgroundColor: "{colors.smoked-card}"
    textColor: "{colors.moon-white}"
    rounded: "{rounded.2xl}"
    padding: "24px"
  input:
    backgroundColor: "{colors.graphite-surface}"
    textColor: "{colors.moon-white}"
    rounded: "{rounded.lg}"
    padding: "10px 14px"
---

# Design System: Lightning Wolves Studio

## Overview

**Creative North Star: "Lightning in the Dark"**

The site is mostly calm, near-black space. Gold is the lightning: rare, sharp and always meaningful — it marks where the visitor acts, never where the interface wants attention. Everything around it stays quiet so that the artists, their faces and their music are what's loud.

The voice is premium and minimal, but the surfaces are tactile: buttons and cards are solid objects that lift and glow when touched, so the calm never feels flat or lifeless. Density is moderate — dashboards and the Studio can be busy, marketing pages breathe.

This file covers the Lightning Wolves site (home, Studio, Wolf Hub/Map, Versus, Golden Board, promoter pages). **JAVEDA (`client/public/javeda/`) and the LAZY JO UNIVERSE (`client/src/lazyjo/lazyjo.css`) are separate worlds with their own systems** — never apply these tokens to them, or theirs here.

**Key Characteristics:**
- Near-black graphite layers, no light theme.
- One gold, used rarely: the primary action and genuine highlights.
- Per-surface accent colours identify where you are in the Studio.
- Uppercase, widely tracked Syncopate headings over plain Inter body.
- Solid, tactile components with hover lift and soft coloured glow.

## Colors

A cold graphite night with a single warm bolt of gold, plus small surface accents.

### Primary
- **Lightning Gold** (`lightning-gold`): the main action on a screen (primary button, the one key highlight), the brand mark and the Templates/Remix surface accent.
- **Ember Amber** (`ember-amber`): the hover/pressed state of gold. Never used on its own at rest.
- **Gold Shadow** (`gold-shadow`): dimmed gold for disabled or secondary gold states.

### Secondary (surface accents — one per Studio surface)
- **Scenes Green** (`scenes-green`): Scenes only.
- **Performance Magenta** (`performance-magenta`): Performance only.
- **Cover Cyan** (`cover-cyan`): Cover Art only.
- **Hub Violet** (`hub-violet`): Wolf Hub / Wolf Map identity.
- Each artist (wolf) also has their own theme colour (`client/src/data/wolves.ts`); on their profile it replaces gold as the accent.

### Neutral
- **Night Black** (`night-black`): page background everywhere.
- **Graphite Surface** (`graphite-surface`): nav, inputs, secondary panels.
- **Smoked Card** (`smoked-card`): cards and raised containers.
- **Iron Border** (`iron-border`): hairline borders, dividers, scrollbar thumb.
- **Moon White** (`moon-white`): primary text.
- **Dusk Lavender** (`dusk-lavender`): secondary text, captions, inactive chips. On Night Black it passes 4.5:1 for body text — don't go dimmer.

### Named Rules
**The Lightning Rule.** Gold appears on at most one primary action per view plus genuine highlights (an award, the live state). Borders, badges, nav pills and decorative frames are neutral by default; if everything is gold, nothing is.

**The One Surface, One Accent Rule.** A Studio surface uses only its own accent next to gold. Scenes is green, never cyan; Cover Art is cyan, never green.

## Typography

**Display Font:** Syncopate (with sans-serif)
**Body Font:** Inter (with sans-serif)
**Numeral Font:** Bebas Neue (with sans-serif)

**Character:** Syncopate's wide, uppercase geometry gives headings a cinematic, poster-like authority; Inter keeps everything else neutral and highly readable. Bebas Neue is for big numbers and scoreboards, not sentences.

### Hierarchy
- **Display** (700, 1.875rem → 3.75rem across breakpoints, 1.05, uppercase, 0.05em tracking): the one hero headline per page; use `text-balance`.
- **Headline** (700, ~1.875rem, uppercase, 0.05em tracking): section titles (all `h1`–`h3` are Syncopate uppercase by default).
- **Numeral** (Bebas Neue 400, 2.25rem+): credits, scores, rankings, counts.
- **Body** (Inter 400, 1rem, 1.5): paragraphs, max ~65ch. Most UI text sits at 0.875rem (`text-sm`).
- **Label** (Inter 500, 0.75rem): chips, meta, helper text.

### Named Rules
**The Quiet Words Rule.** Syncopate is for short headings only (≤ 8 words). Never set paragraphs, buttons with long labels or form text in it.

## Layout

Tailwind's 4px spacing scale (`gap-2` 8px and `px-4`/`py-3` dominate). Content containers are centred at `max-w-5xl`/`max-w-6xl`; the site nav uses up to 1600px. Breakpoints are Tailwind's defaults (640 / 768 / 1024 / 1280 / 1536). Mobile-first: phone layouts are the baseline, and the site nav folds into the menu button below 1280px.

Full-height sections use small-viewport units (`100svh`, enforced globally on `.min-h-screen`/`.h-screen`) — never raw `100vh`, which makes mobile pages jump when the URL bar moves. The page never scrolls horizontally (`overflow-x: hidden` on html/body).

## Elevation & Depth

Depth comes from tonal layering first (Night Black → Graphite Surface → Smoked Card, separated by Iron Border hairlines), and from light second: interactive elements lift with a soft glow in their own colour on hover (`shadow-lg` tinted, e.g. gold at 25%). There are no grey drop shadows on a black page — on black, depth is glow, not shadow.

### Shadow Vocabulary
- **Hover glow** (`box-shadow: 0 10px 15px -3px <accent>/25%` via `hover:shadow-lg hover:shadow-<accent>/25`): primary and accent buttons on hover.
- **Breathing CTA glow** (`.animate-cta-glow`, 2.4s): reserved for one supporting CTA (e.g. fan support / merch); never more than one per view.
- **Panel lift** (`shadow-xl`/`shadow-2xl`): modals and floating panels only.

### Named Rules
**The Glow Not Shadow Rule.** Elevation on dark is expressed with coloured light. If a glow doesn't match the element's own accent, remove it.

## Shapes

Gently curved, never sharp and never blobby. Buttons, nav items and inputs use 8px corners (`rounded-lg`); cards use 12–16px (`rounded-xl`/`rounded-2xl`); pills, avatars and badges are fully round. Borders are 1px Iron Border at rest, warming to the element's accent at ~30% on hover.

## Components

### Buttons
Solid and tactile: they feel pressable.
- **Shape:** gently curved (8px).
- **Primary:** Lightning Gold fill, Night Black text, semibold, 14px × 32px padding. One per view (The Lightning Rule).
- **Hover / Focus:** fill shifts to Ember Amber and a gold glow appears beneath; focus shows a visible ring. Transition ~200ms.
- **Secondary:** transparent on Night Black with an Iron Border outline and Moon White text; on hover the border warms to gold at 30% and the fill to gold at 5%.
- **Credit CTAs:** cost always inline in the label (`Generate Video 💎 60`).

### Chips
- **Style:** fully round, Smoked Card fill, Dusk Lavender text, 0.75rem.
- **State:** selected chips take the current surface accent at low opacity with accent text; gold only when the chip *is* the primary choice.

### Cards / Containers
- **Corner Style:** 12–16px.
- **Background:** Smoked Card on Night Black.
- **Shadow Strategy:** flat at rest; accent glow and slight lift on hover when clickable (see Elevation).
- **Border:** 1px Iron Border.
- **Internal Padding:** 16–24px.

### Inputs / Fields
- **Style:** Graphite Surface fill, 1px Iron Border, 8px corners, Moon White text, Dusk Lavender placeholder.
- **Focus:** border shifts to the surface accent with a soft matching glow.
- **Error:** red border plus an inline message; never colour alone.

### Navigation
- Top bar on Night Black at 70% with backdrop blur and a hairline bottom border.
- Items are 8px-rounded pills in Inter 0.875rem; the active surface uses its own accent tint.
- Below 1280px the links collapse into the menu button; labels never wrap.

### Inline validation card (signature)
A small accent-bordered card directly under a disabled CTA, explaining in one line what's missing — instead of a tooltip or modal.

### Health indicator (signature)
`● Running smoothly · Powered by <model>` in label size under generate buttons.

## Do's and Don'ts

### Do:
- **Do** keep gold to the primary action and real highlights (The Lightning Rule).
- **Do** give every clickable surface a tactile hover: lift and a glow in its own accent.
- **Do** use the surface's own accent in the Studio and the artist's colour on their profile.
- **Do** use `svh` for full-height sections and test at 375px and 1440px.
- **Do** respect `prefers-reduced-motion`: looping glows and floats stop.
- **Do** show prices and credits inline on CTAs, never only in a tooltip.

### Don't:
- **Don't** add gold borders, gold badges or gold nav pills by default.
- **Don't** use grey drop shadows on the black page; use tonal layers and glow.
- **Don't** set long text in Syncopate or go dimmer than Dusk Lavender for readable text.
- **Don't** introduce a light theme or new neutrals outside this palette.
- **Don't** bring JAVEDA's or the LAZY JO UNIVERSE's styles into the main site, or these into them.
- **Don't** run more than one breathing/pulsing glow in a view.
