interface Props {
  url: string;
}

export default function SpotifyEmbed({ url }: Props) {
  // Convert to embed URL format with dark theme
  const embedUrl = url.includes("/embed/")
    ? `${url}?utm_source=generator&theme=0`
    : url.replace("open.spotify.com/", "open.spotify.com/embed/") +
      "?utm_source=generator&theme=0";

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-wolf-border/30">
      <iframe
        src={embedUrl}
        width="100%"
        height="352"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        style={{ border: 0, borderRadius: "16px" }}
        title="Spotify Player"
      />
    </div>
  );
}
