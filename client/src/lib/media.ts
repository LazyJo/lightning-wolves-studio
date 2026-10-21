// The big site media (wolf videos, the 3D wolf, the JAVEDA songs) live in the public
// Supabase Storage bucket `media`, not in the Vercel deploy: on the Hobby plan every
// deployment counts against 10 GB, and these files made each one ~150 MB.
export const MEDIA_BASE = "https://wjvvkffroujkhbisxnab.supabase.co/storage/v1/object/public/media";
export const media = (path: string) => `${MEDIA_BASE}/${path}`;
