import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, Check } from "lucide-react";

interface Props {
  file: File | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

const PREVIEW_SIZE = 240;
const OUTPUT_SIZE = 512;

export default function AvatarCropper({ file, onCancel, onConfirm }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [working, setWorking] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (!file) {
      setSrc(null);
      setImgNatural(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // When the natural image dimensions are known, fit-cover into the preview
  // (image fully covers the circle, smallest dimension = PREVIEW_SIZE).
  useEffect(() => {
    if (!imgNatural) return;
    const fit = Math.max(PREVIEW_SIZE / imgNatural.w, PREVIEW_SIZE / imgNatural.h);
    setMinScale(fit);
    setScale(fit);
    // Center the image
    setOffset({
      x: (PREVIEW_SIZE - imgNatural.w * fit) / 2,
      y: (PREVIEW_SIZE - imgNatural.h * fit) / 2,
    });
  }, [imgNatural]);

  function clampOffset(x: number, y: number, s: number) {
    if (!imgNatural) return { x, y };
    const w = imgNatural.w * s;
    const h = imgNatural.h * s;
    // Clamp so image always covers the preview square.
    const minX = PREVIEW_SIZE - w;
    const minY = PREVIEW_SIZE - h;
    const cx = Math.min(0, Math.max(minX, x));
    const cy = Math.min(0, Math.max(minY, y));
    return { x: cx, y: cy };
  }

  function onMouseDown(e: React.MouseEvent | React.TouchEvent) {
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    dragRef.current = { startX: point.clientX, startY: point.clientY, ox: offset.x, oy: offset.y };
  }
  function onMouseMove(e: MouseEvent | TouchEvent) {
    if (!dragRef.current) return;
    const point = "touches" in e ? e.touches[0] : (e as MouseEvent);
    const dx = point.clientX - dragRef.current.startX;
    const dy = point.clientY - dragRef.current.startY;
    const next = clampOffset(dragRef.current.ox + dx, dragRef.current.oy + dy, scale);
    setOffset(next);
  }
  function onMouseUp() {
    dragRef.current = null;
  }
  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onMouseMove, { passive: false });
    window.addEventListener("touchend", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onMouseMove);
      window.removeEventListener("touchend", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, offset.x, offset.y, imgNatural]);

  function onScaleChange(next: number) {
    if (!imgNatural) return;
    // Keep the centre of the preview anchored when scaling.
    const cx = PREVIEW_SIZE / 2;
    const cy = PREVIEW_SIZE / 2;
    const ratio = next / scale;
    const newX = cx - (cx - offset.x) * ratio;
    const newY = cy - (cy - offset.y) * ratio;
    setScale(next);
    setOffset(clampOffset(newX, newY, next));
  }

  async function confirm() {
    if (!src || !imgNatural || working) return;
    setWorking(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("image load failed"));
        img.src = src;
      });
      // The visible preview area maps to a source rect in the original image:
      //   top-left:    (-offset.x / scale, -offset.y / scale)
      //   size:        (PREVIEW_SIZE / scale, PREVIEW_SIZE / scale)
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sSize = PREVIEW_SIZE / scale;

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      // Circular clip — saves on storage if Supabase ever delivers an
      // alpha-channel-aware preview. Avatar primitive masks again anyway,
      // but the output file matches what users see.
      ctx.save();
      ctx.beginPath();
      ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      ctx.restore();
      const blob: Blob | null = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/png", 0.92);
      });
      if (!blob) throw new Error("blob encode failed");
      onConfirm(blob);
    } catch {
      onCancel();
    } finally {
      setWorking(false);
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {file && src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: [0.2, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-[min(360px,100%)] overflow-hidden rounded-2xl border border-white/10 bg-wolf-card/95 p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Crop your photo</h3>
              <button
                type="button"
                onClick={onCancel}
                aria-label="Cancel"
                className="rounded-full p-1 text-wolf-muted transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div
              className="relative mx-auto cursor-grab overflow-hidden rounded-full border border-white/10 bg-black/40 active:cursor-grabbing"
              style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
              onMouseDown={onMouseDown}
              onTouchStart={onMouseDown}
            >
              <img
                src={src}
                alt="Crop preview"
                draggable={false}
                onLoad={(e) => {
                  const i = e.currentTarget;
                  setImgNatural({ w: i.naturalWidth, h: i.naturalHeight });
                }}
                style={{
                  position: "absolute",
                  left: offset.x,
                  top: offset.y,
                  width: imgNatural ? imgNatural.w * scale : "auto",
                  height: imgNatural ? imgNatural.h * scale : "auto",
                  userSelect: "none",
                  pointerEvents: "none",
                  maxWidth: "none",
                }}
              />
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-wolf-muted">
                Zoom
              </label>
              <input
                type="range"
                min={minScale}
                max={minScale * 4}
                step={0.01}
                value={scale}
                onChange={(e) => onScaleChange(parseFloat(e.target.value))}
                className="w-full accent-[#9b6dff]"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-wolf-muted transition-all hover:border-white/20 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!imgNatural || working}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#9b6dff] to-[#E040FB] px-3 py-1.5 text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
              >
                <Check size={12} />
                {working ? "Saving…" : "Use this crop"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
