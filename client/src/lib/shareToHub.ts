import { initSupabase } from "./supabaseClient";

export interface ShareToHubInput {
  audio: File;
  title: string;
  // Optional genre tag — drives the genre filter chips on #beats.
  // Falls back to "other" so the message still surfaces under "All".
  genre?: string;
}

export interface ShareToHubResult {
  ok: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Posts a Studio audio file to #beats. Closes the Hub→Studio→Hub
 * conversion loop: a creator who finishes a template can ship it to
 * the pack with one click instead of re-uploading via the Hub composer.
 *
 * Caller is responsible for the auth gate — this returns
 * `{ ok: false, error: 'unauthenticated' }` if no session.
 */
export async function shareToHub(input: ShareToHubInput): Promise<ShareToHubResult> {
  const sb = await initSupabase();
  if (!sb) return { ok: false, error: "Supabase not configured" };

  const { data: sess } = await sb.auth.getSession();
  const user = sess?.session?.user;
  if (!user) return { ok: false, error: "unauthenticated" };

  // Pull the profile fields we denormalize onto the message (matches
  // the WolfHubPage sendMessage shape). RLS lets us read our own row.
  const { data: profile } = await sb
    .from("profiles")
    .select("id, display_name, wolf_id, email, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return { ok: false, error: "profile_missing" };

  // Upload audio to the same bucket #beats uses for native uploads.
  const ext = input.audio.name.split(".").pop()?.toLowerCase() || "mp3";
  const safeExt = ext.replace(/[^a-z0-9]/g, "") || "mp3";
  const path = `beats/${profile.id}/${Date.now()}-studio.${safeExt}`;
  const { error: upErr } = await sb.storage
    .from("wolf-hub-media")
    .upload(path, input.audio, { contentType: input.audio.type || "audio/mpeg" });
  if (upErr) return { ok: false, error: upErr.message };

  const { data: urlData } = sb.storage.from("wolf-hub-media").getPublicUrl(path);
  if (!urlData?.publicUrl) return { ok: false, error: "no_public_url" };

  // The 🎬 body prefix is kept as a render fallback for messages
  // posted before the `from_studio` column landed. New posts set the
  // column directly; ChatView prefers it and only falls back to the
  // prefix for legacy rows.
  const body = `🎬 ${input.title}`;

  const { data: inserted, error: insErr } = await sb
    .from("hub_messages")
    .insert({
      author_id: profile.id,
      author_name: profile.display_name || profile.email?.split("@")[0] || null,
      author_wolf_id: profile.wolf_id,
      author_avatar_url: profile.avatar_url,
      room_id: "beats",
      body,
      audio_url: urlData.publicUrl,
      genre: input.genre ?? "other",
      from_studio: true,
    })
    .select("id")
    .single();

  if (insErr) return { ok: false, error: insErr.message };
  return { ok: true, messageId: inserted?.id };
}
