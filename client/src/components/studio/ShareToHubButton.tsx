import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { shareToHub } from "../../lib/shareToHub";
import { getTemplateAudioFile, type Template } from "../../lib/templates";
import { useSession } from "../../lib/useSession";

interface Props {
  template: Template;
  // Called when the user clicks the success pill — caller navigates
  // to the Hub at the freshly-posted message.
  onJumpToPost?: (messageId: string) => void;
  onAuthRequired?: () => void;
}

type State =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "posted"; messageId: string }
  | { kind: "error"; message: string };

/**
 * Studio → #beats one-click share. Closes the conversion loop —
 * the inverse of the per-beat "Make lyric video" handoff in the Hub.
 * After a template is ready, the creator can drop it straight into
 * the pack instead of re-uploading via the Hub composer.
 */
export default function ShareToHubButton({ template, onJumpToPost, onAuthRequired }: Props) {
  const { session } = useSession();
  const [state, setState] = useState<State>({ kind: "idle" });

  const handleClick = async () => {
    if (!session?.user) {
      onAuthRequired?.();
      return;
    }
    setState({ kind: "uploading" });
    const file = await getTemplateAudioFile(template.id);
    if (!file) {
      setState({ kind: "error", message: "Couldn't read the template audio." });
      return;
    }
    const res = await shareToHub({
      audio: file,
      title: template.title,
      genre: template.genre,
    });
    if (!res.ok || !res.messageId) {
      if (res.error === "unauthenticated") {
        onAuthRequired?.();
        setState({ kind: "idle" });
        return;
      }
      setState({
        kind: "error",
        message: res.error || "Could not post to #beats.",
      });
      return;
    }
    setState({ kind: "posted", messageId: res.messageId });
  };

  if (state.kind === "posted") {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => onJumpToPost?.(state.messageId)}
        className="inline-flex items-center gap-2 rounded-lg border border-green-400/40 bg-green-400/10 px-3 py-2 text-xs font-bold text-green-300 transition-all hover:border-green-400/70 hover:bg-green-400/15"
        title="Open this beat in the Wolf Hub"
      >
        <CheckCircle2 size={14} />
        Posted to #beats — view it →
      </motion.button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={state.kind === "uploading"}
        title={
          session?.user
            ? "Post this beat to #beats in the Wolf Hub"
            : "Sign in to share to the Hub"
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-wolf-gold/40 bg-gradient-to-r from-wolf-gold/15 to-wolf-amber/10 px-3 py-2 text-xs font-bold text-wolf-gold transition-all hover:border-wolf-gold/70 hover:bg-wolf-gold/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state.kind === "uploading" ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Send size={12} />
        )}
        <span>{state.kind === "uploading" ? "Posting…" : "Share to #beats"}</span>
      </button>
      <AnimatePresence>
        {state.kind === "error" && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="inline-flex max-w-[260px] items-center gap-1 text-[10px] text-red-300/80"
          >
            <AlertCircle size={10} />
            <span className="truncate">{state.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
