import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";
import { COLORS } from "../lib/brand";

export const PHOTO = "assets/lazyjo-photo.jpg";
export const CUTOUT = "generated/lazyjo-cutout.png";

type Zoom = { scale: number; x?: number; y?: number };

const zoomStyle = ({ scale, x = 0, y = 0 }: Zoom): React.CSSProperties => ({
  transform: `translate(${x}px, ${y}px) scale(${scale})`,
  transformOrigin: "50% 45%",
});

const cover: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

/**
 * The StayUp shoot photo as a layered plate:
 *   background (graded photo | solid colour) → `behind` → subject cutout → `front`.
 * Photo and cutout share the exact same geometry, so anything passed as
 * `behind` reads as sitting *behind* Jo (text-behind-subject).
 */
export const PhotoPlate: React.FC<{
  zoom: Zoom;
  background: "photo" | "yellow" | "black";
  behind?: React.ReactNode;
  front?: React.ReactNode;
  cutoutFilter?: string;
  photoFilter?: string;
}> = ({ zoom, background, behind, front, cutoutFilter, photoFilter }) => (
  <AbsoluteFill style={{ backgroundColor: background === "yellow" ? COLORS.yellow : COLORS.black }}>
    {background === "yellow" ? (
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 55% at 50% 42%, ${COLORS.yellowHot} 0%, ${COLORS.yellow} 55%, #d9a800 100%)`,
        }}
      />
    ) : null}
    {background === "photo" ? (
      <AbsoluteFill style={zoomStyle(zoom)}>
        <Img
          src={staticFile(PHOTO)}
          style={{ ...cover, filter: photoFilter ?? "contrast(1.12) saturate(0.9) brightness(0.95)" }}
        />
      </AbsoluteFill>
    ) : null}
    {behind}
    <AbsoluteFill style={zoomStyle(zoom)}>
      <Img src={staticFile(CUTOUT)} style={{ ...cover, filter: cutoutFilter }} />
    </AbsoluteFill>
    {front}
  </AbsoluteFill>
);

/**
 * Black→yellow duotone: greyscale the source, multiply by brand yellow.
 * Turns any footage (soft, differently lit, off-palette) into on-brand art.
 */
export const Duotone: React.FC<{ children: React.ReactNode; contrast?: number; tint?: string }> = ({
  children,
  contrast = 1.35,
  tint = COLORS.yellow,
}) => (
  <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
    <AbsoluteFill style={{ filter: `grayscale(1) contrast(${contrast}) brightness(1.05)` }}>{children}</AbsoluteFill>
    <AbsoluteFill style={{ backgroundColor: tint, mixBlendMode: "multiply" }} />
  </AbsoluteFill>
);

/** Live show footage (848×478 @60fps) — cropped to fill a vertical frame. */
export const LiveFootage: React.FC<{
  startFrom: number;
  playbackRate?: number;
  zoom?: number;
  focusX?: number;
}> = ({ startFrom, playbackRate = 1, zoom = 1, focusX = 50 }) => (
  <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
    <OffthreadVideo
      src={staticFile("assets/live.mp4")}
      trimBefore={startFrom}
      playbackRate={playbackRate}
      muted
      style={{ ...cover, objectPosition: `${focusX}% 50%` }}
    />
  </AbsoluteFill>
);

/** The glowing yellow wolf from the profile card (2160² @24fps). */
export const WolfCardFootage: React.FC<{ startFrom?: number; playbackRate?: number; zoom?: number }> = ({
  startFrom = 0,
  playbackRate = 1,
  zoom = 1,
}) => (
  <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
    <OffthreadVideo
      src={staticFile("assets/wolf-card.mp4")}
      trimBefore={startFrom}
      playbackRate={playbackRate}
      muted
      style={cover}
    />
  </AbsoluteFill>
);
