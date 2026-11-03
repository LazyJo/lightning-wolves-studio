// JAVEDA - the notifications (Supabase Edge Function "javeda-push"). How it's set up: README.md next to this file.
// - {"run": true} with the x-javeda-key header: what pg_cron sends every 5 minutes. Sends "someone beat your score"
//   (javeda_push_take: the queue the score triggers fill, one message a player) and, once a day at 8:00 in Brussels,
//   "today's challenge is up" (javeda_push_daily_due).
// - {"hello": "<push address>"}: from the page, right after a phone turns notifications on - a first message to that
//   phone only, so the player sees it works. Only an address that is signed up gets one, at most every 10 minutes.
// A phone whose push service says it's gone (404/410) is forgotten.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const KEY = Deno.env.get("JAVEDA_PUSH_KEY") ?? "";
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "", VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:lazyjo.official@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Lang = "en" | "nl" | "fr" | "es";
type Sub = { endpoint: string; p256dh: string; auth: string; lang: Lang };
type Beaten = Sub & { n: number; people: number; level: string; num: number; title: string; endless: boolean; daily: boolean; by: string | null; score: number };

// the words, in the phone's language
const W = {
  daily: { en: "Today's challenge is up", nl: "De uitdaging van vandaag staat klaar", fr: "Le défi du jour est là", es: "El reto de hoy ya está aquí" },
  dailyBody: {
    en: (lv: string) => lv + ". The same song for everyone today, with a board of its own.",
    nl: (lv: string) => lv + ". Vandaag hetzelfde nummer voor iedereen, met een eigen scorebord.",
    fr: (lv: string) => lv + ". Le même morceau pour tout le monde aujourd'hui, avec son propre classement.",
    es: (lv: string) => lv + ". La misma canción para todos hoy, con su propia clasificación.",
  },
  level: { en: "Level", nl: "Level", fr: "Niveau", es: "Nivel" },
  today: { en: "Today's challenge", nl: "De uitdaging van vandaag", fr: "Le défi du jour", es: "El reto de hoy" },
  someone: { en: "Someone", nl: "Iemand", fr: "Quelqu'un", es: "Alguien" },
  beat: {
    en: (by: string, more: number) => by + (more ? " and " + more + " more" : "") + " beat your score",
    nl: (by: string, more: number) => by + (more ? " en nog " + more : "") + (more ? " hebben" : " heeft") + " je score verslagen",
    fr: (by: string, more: number) => by + (more ? " et " + more + (more > 1 ? " autres ont" : " autre ont") : " a") + " battu ton score",
    es: (by: string, more: number) => by + (more ? " y " + more + " más han" : " ha") + " superado tu puntuación",
  },
  back: {
    en: (board: string, s: string) => board + ": " + s + ". Take your place back?",
    nl: (board: string, s: string) => board + ": " + s + ". Pak je plek terug?",
    fr: (board: string, s: string) => board + " : " + s + ". Tu reprends ta place ?",
    es: (board: string, s: string) => board + ": " + s + ". ¿Recuperas tu puesto?",
  },
  hello: { en: "JAVEDA notifications are on", nl: "JAVEDA-meldingen staan aan", fr: "Les notifications JAVEDA sont activées", es: "Las notificaciones de JAVEDA están activadas" },
  helloBody: {
    en: "This is how they look. You can turn them off in your player, any time.",
    nl: "Zo zien ze eruit. Je zet ze uit bij je speler, wanneer je wil.",
    fr: "Voilà à quoi elles ressemblent. Tu peux les couper dans ton joueur, quand tu veux.",
    es: "Así se ven. Puedes desactivarlas en tu jugador cuando quieras.",
  },
};
const L = (s: Sub): Lang => (["en", "nl", "fr", "es"].includes(s.lang) ? s.lang : "en");
const LOCALE = { en: "en-GB", nl: "nl-BE", fr: "fr-BE", es: "es-ES" };
const levelName = (l: Lang, num: number, title: string, endless = false) => W.level[l] + " " + num + " · " + title + (endless ? " ∞" : "");

// one message to one phone: true when it went, "gone" when the phone isn't there any more
async function send(s: Sub, msg: { title: string; body: string; url: string; tag: string }, ttl: number): Promise<true | false | "gone"> {
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: ttl, urgency: "normal" });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) { await db.from("javeda_push").delete().eq("endpoint", s.endpoint); return "gone"; }
    console.log("push failed", code ?? String(e).slice(0, 200));
    return false;
  }
}
// many at once, 20 at a time
async function sendAll<T extends Sub>(list: T[], make: (s: T) => Parameters<typeof send>[1], ttl: number) {
  const n = { sent: 0, gone: 0, failed: 0 };
  for (let i = 0; i < list.length; i += 20) {
    const r = await Promise.all(list.slice(i, i + 20).map(s => send(s, make(s), ttl)));
    for (const x of r) x === true ? n.sent++ : x === "gone" ? n.gone++ : n.failed++;
  }
  return n;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !KEY) return json({ error: "not set up" }, 500);
  const body = await req.json().catch(() => ({}));

  // the page: a first message to the phone that just turned notifications on
  if (typeof body.hello === "string") {
    const { data: s } = await db.from("javeda_push").select("endpoint, p256dh, auth, lang, hello_at").eq("endpoint", body.hello).maybeSingle();
    if (!s) return json({ error: "not signed up" }, 404);
    if (s.hello_at && Date.now() - new Date(s.hello_at).getTime() < 10 * 60e3) return json({ ok: true, sent: 0, note: "once every 10 minutes" });
    await db.from("javeda_push").update({ hello_at: new Date().toISOString() }).eq("endpoint", s.endpoint);
    const l = L(s as Sub), r = await send(s as Sub, { title: W.hello[l], body: W.helloBody[l], url: "/javeda/", tag: "javeda-hello" }, 600);
    return json({ ok: r === true, sent: r === true ? 1 : 0 });
  }

  // pg_cron
  if (req.headers.get("x-javeda-key") !== KEY) return json({ error: "no" }, 401);
  const out: Record<string, unknown> = { ok: true };

  const { data: beaten, error: e1 } = await db.rpc("javeda_push_take");
  if (e1) return json({ error: e1.message }, 500);
  out.beaten = await sendAll((beaten ?? []) as Beaten[], s => {
    const l = L(s), board = s.daily ? W.today[l] : levelName(l, s.num, s.title, s.endless);
    const score = new Intl.NumberFormat(LOCALE[l]).format(s.score ?? 0);
    return { title: W.beat[l](s.by || W.someone[l], Math.max(0, s.people - 1)), body: W.back[l](board, score),
      url: "/javeda/#board=" + (s.daily ? "daily" : s.level), tag: "javeda-beaten" };
  }, 6 * 3600);

  const { data: daily, error: e2 } = await db.rpc("javeda_push_daily_due");
  if (e2) return json({ ...out, error: e2.message }, 500);
  if (daily) out.daily = await sendAll((daily.subs ?? []) as Sub[], s => {
    const l = L(s);
    return { title: W.daily[l], body: W.dailyBody[l](levelName(l, daily.num, daily.title)), url: "/javeda/#daily", tag: "javeda-daily" };
  }, 12 * 3600);

  return json(out);
});
