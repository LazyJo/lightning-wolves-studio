import { forwardRef, useEffect, useRef, useState } from "react";
import type { Single } from "../catalog";
import { ytEmbedUrl, ytLoop } from "../ytLoop";

/** The song's music video, laid exactly over its presented 3D cover (position fed by the engine). */
const VideoScreen = forwardRef<HTMLDivElement, { single: Single }>(function VideoScreen({ single }, ref) {
  const spec = single.youtube!;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const f = frameRef.current;
    if (!f) return;
    ytLoop.attach(f, single, spec);
    const off = ytLoop.subscribe(() => setLive(ytLoop.activeFor(single.id)));
    // the embed only starts reporting after it hears "listening"; say it a few times while it boots
    let tries = 0;
    const hello = window.setInterval(() => {
      ytLoop.hello();
      if (++tries > 20 || ytLoop.live) window.clearInterval(hello);
    }, 500);
    return () => {
      window.clearInterval(hello);
      off();
      ytLoop.detach(f);
    };
  }, [single, spec]);

  return (
    <div ref={ref} className={`lj-vscreen ${live ? "is-live" : ""}`} data-on="0" aria-hidden="true" style={{ ["--lj-vzoom" as string]: String(spec.zoom) }}>
      <iframe
        ref={frameRef}
        src={ytEmbedUrl(spec)}
        title={`${single.title} music video`}
        allow="autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        tabIndex={-1}
        onLoad={() => ytLoop.hello()}
      />
    </div>
  );
});

export default VideoScreen;
