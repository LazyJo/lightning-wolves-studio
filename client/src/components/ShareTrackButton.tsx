import { useState } from "react";
import { Share2, Check } from "lucide-react";

interface Props {
  url: string;
  title?: string;
}

export default function ShareTrackButton({ url, title }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    // Prefer the native share sheet when available (mobile mostly) —
    // falls back to clipboard on desktop or when user cancels.
    const nav = navigator as Navigator & {
      share?: (data: { url: string; title?: string }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ url, title });
        return;
      } catch {
        /* user cancelled or share failed — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* no clipboard permission — nothing we can do silently */
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={copied ? "Copied!" : "Share track"}
      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-semibold text-wolf-muted transition-all hover:border-white/20 hover:text-white"
    >
      {copied ? (
        <>
          <Check size={12} className="text-[#10b981]" />
          <span className="text-[#10b981]">Copied</span>
        </>
      ) : (
        <>
          <Share2 size={12} />
          <span>Share</span>
        </>
      )}
    </button>
  );
}
