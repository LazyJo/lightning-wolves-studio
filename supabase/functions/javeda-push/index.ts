// JAVEDA - the notifications (Supabase Edge Function "javeda-push"). How it's set up: README.md next to this file.
// - {"run": true} with the x-javeda-key header: what pg_cron sends every 5 minutes. Sends "someone beat your score"
//   (javeda_push_take: the queue the score triggers fill, one message a player) and, once a day at 8:00 on each phone's clock,
//   "today's challenge is up" (javeda_push_daily_due), and the chat ones: "X reacted 🔥 to your message" / "X mentioned
//   you in the chat" (javeda_push_chat_take, at most one an hour a player).
//   Once a phone, from javeda_settings.acct_push_at: "Join the JAVEDA challenges" to the phones with no account - the first
//   batch, then each new one 2 days after it said yes, at 19:00 on its clock (javeda_push_acct_due); "...are open" once they are.
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

type Lang = "en" | "nl" | "fr" | "es" | "it" | "tr" | "ja" | "zh" | "tw";
type Sub = { endpoint: string; p256dh: string; auth: string; lang: Lang };
type Chat = Sub & { mentions: number; m_by: string | null; m_body: string | null; reacts: number; people: number; r_by: string | null; emojis: string | null; r_body: string | null };
type Beaten = Sub & { n: number; people: number; level: string; num: number; title: string; endless: boolean; daily: boolean; by: string | null; score: number };

// the words, in the phone's language
const W = {
  daily: { en: "Today's challenge is up", nl: "De uitdaging van vandaag staat klaar", fr: "Le défi du jour est là", es: "El reto de hoy ya está aquí",
    it: "La sfida di oggi è qui", tr: "Günün meydan okuması hazır", ja: "今日のチャレンジが始まったよ", zh: "今日挑战来了", tw: "今日挑戰來了" },
  dailyBody: {
    en: (lv: string) => lv + ". The same song for everyone today, with a board of its own.",
    nl: (lv: string) => lv + ". Vandaag hetzelfde nummer voor iedereen, met een eigen scorebord.",
    fr: (lv: string) => lv + ". Le même morceau pour tout le monde aujourd'hui, avec son propre classement.",
    es: (lv: string) => lv + ". La misma canción para todos hoy, con su propia clasificación.",
    it: (lv: string) => lv + ". La stessa canzone per tutti oggi, con una classifica tutta sua.",
    tr: (lv: string) => lv + ". Bugün herkes için aynı şarkı, kendi skor tablosuyla.",
    ja: (lv: string) => lv + "。今日はみんな同じ曲、専用のランキング付き。",
    zh: (lv: string) => lv + "。今天大家玩同一首歌，有专属排行榜。",
    tw: (lv: string) => lv + "。今天大家玩同一首歌，有專屬排行榜。",
  },
  level: { en: "Level", nl: "Level", fr: "Niveau", es: "Nivel", it: "Livello", tr: "Seviye", ja: "レベル", zh: "第", tw: "第" },
  today: { en: "Today's challenge", nl: "De uitdaging van vandaag", fr: "Le défi du jour", es: "El reto de hoy", it: "La sfida di oggi", tr: "Günün meydan okuması", ja: "今日のチャレンジ", zh: "今日挑战", tw: "今日挑戰" },
  someone: { en: "Someone", nl: "Iemand", fr: "Quelqu'un", es: "Alguien", it: "Qualcuno", tr: "Biri", ja: "だれか", zh: "有人", tw: "有人" },
  beat: {
    en: (by: string, more: number) => by + (more ? " and " + more + " more" : "") + " beat your score",
    nl: (by: string, more: number) => by + (more ? " en nog " + more : "") + (more ? " hebben" : " heeft") + " je score verslagen",
    fr: (by: string, more: number) => by + (more ? " et " + more + (more > 1 ? " autres ont" : " autre ont") : " a") + " battu ton score",
    es: (by: string, more: number) => by + (more ? " y " + more + " más han" : " ha") + " superado tu puntuación",
    it: (by: string, more: number) => by + (more ? " e altri " + more + " hanno" : " ha") + " battuto il tuo punteggio",
    tr: (by: string, more: number) => "Skorun geçildi: " + by + (more ? " ve " + more + " kişi daha" : ""),
    ja: (by: string, more: number) => by + (more ? "とほか" + more + "人" : "") + "があなたのスコアを抜いた",
    zh: (by: string, more: number) => by + (more ? "和另外" + more + "人" : "") + "超过了你的分数",
    tw: (by: string, more: number) => by + (more ? "和另外" + more + "人" : "") + "超越了你的分數",
  },
  back: {
    en: (board: string, s: string) => board + ": " + s + ". Take your place back?",
    nl: (board: string, s: string) => board + ": " + s + ". Pak je plek terug?",
    fr: (board: string, s: string) => board + " : " + s + ". Tu reprends ta place ?",
    es: (board: string, s: string) => board + ": " + s + ". ¿Recuperas tu puesto?",
    it: (board: string, s: string) => board + ": " + s + ". Ti riprendi il tuo posto?",
    tr: (board: string, s: string) => board + ": " + s + ". Yerini geri alır mısın?",
    ja: (board: string, s: string) => board + "：" + s + "。順位を取り戻す？",
    zh: (board: string, s: string) => board + "：" + s + "。要夺回你的名次吗？",
    tw: (board: string, s: string) => board + "：" + s + "。要奪回你的名次嗎？",
  },
  mention: {
    en: (by: string) => by + " mentioned you in the chat", nl: (by: string) => by + " noemde je in de chat",
    fr: (by: string) => by + " t'a mentionné dans le chat", es: (by: string) => by + " te mencionó en el chat",
    it: (by: string) => by + " ti ha menzionato nella chat", tr: (by: string) => by + " sohbette senden bahsetti",
    ja: (by: string) => by + "がチャットであなたをメンションしたよ", zh: (by: string) => by + " 在聊天中提到了你", tw: (by: string) => by + " 在聊天中提到了你",
  },
  react: {
    en: (by: string, more: number, e: string) => by + (more ? " and " + more + (more > 1 ? " others" : " other") : "") + " reacted " + e + " to your message",
    nl: (by: string, more: number, e: string) => by + (more ? " en nog " + more : "") + " reageerde" + (more ? "n" : "") + " " + e + " op je bericht",
    fr: (by: string, more: number, e: string) => by + (more ? " et " + more + (more > 1 ? " autres ont" : " autre ont") : " a") + " réagi " + e + " à ton message",
    es: (by: string, more: number, e: string) => by + (more ? " y " + more + " más reaccionaron" : " reaccionó") + " " + e + " a tu mensaje",
    it: (by: string, more: number, e: string) => by + (more ? " e altri " + more + " hanno" : " ha") + " reagito " + e + " al tuo messaggio",
    tr: (by: string, more: number, e: string) => by + (more ? " ve " + more + " kişi daha" : "") + " mesajına " + e + " tepkisi verdi",
    ja: (by: string, more: number, e: string) => by + (more ? "とほか" + more + "人" : "") + "があなたのメッセージに" + e + "でリアクションしたよ",
    zh: (by: string, more: number, e: string) => by + (more ? "和另外" + more + "人" : "") + "用 " + e + " 回应了你的消息",
    tw: (by: string, more: number, e: string) => by + (more ? "和另外" + more + "人" : "") + "用 " + e + " 回應了你的訊息",
  },
  hello: { en: "JAVEDA notifications are on", nl: "JAVEDA-meldingen staan aan", fr: "Les notifications JAVEDA sont activées", es: "Las notificaciones de JAVEDA están activadas",
    it: "Le notifiche di JAVEDA sono attive", tr: "JAVEDA bildirimleri açık", ja: "JAVEDAの通知がオンになったよ", zh: "JAVEDA 通知已开启", tw: "JAVEDA 通知已開啟" },
  helloBody: {
    en: "This is how they look. You can turn them off in your player, any time.",
    nl: "Zo zien ze eruit. Je zet ze uit bij je speler, wanneer je wil.",
    fr: "Voilà à quoi elles ressemblent. Tu peux les couper dans ton joueur, quand tu veux.",
    es: "Así se ven. Puedes desactivarlas en tu jugador cuando quieras.",
    it: "Ecco come appaiono. Puoi disattivarle nel tuo giocatore, quando vuoi.",
    tr: "Bildirimler böyle görünür. Oyuncu sayfandan istediğin zaman kapatabilirsin.",
    ja: "通知はこんな感じで届きます。プレイヤー画面でいつでもオフにできます。",
    zh: "通知就是这样的。你随时可以在玩家页面关闭。",
    tw: "通知就是這樣的。你隨時可以在玩家頁面關閉。",
  },
  // once, to the phones with no account (javeda_push_acct_due): create one and join the challenges
  acct: { en: "🏆 Join the JAVEDA challenges", nl: "🏆 Doe mee aan de JAVEDA-uitdagingen", fr: "🏆 Rejoins les défis JAVEDA", es: "🏆 Únete a los retos de JAVEDA",
    it: "🏆 Partecipa alle sfide JAVEDA", tr: "🏆 JAVEDA meydan okumalarına katıl", ja: "🏆 JAVEDAチャレンジに参加しよう", zh: "🏆 加入 JAVEDA 挑战", tw: "🏆 加入 JAVEDA 挑戰" },
  acctBody: {
    en: (a: string, n: string) => "Create a free account to play the Monthly and the Super. " + a + " of the " + n + " accounts are there: yours counts.",
    nl: (a: string, n: string) => "Maak een gratis account om de maanduitdaging en de Superuitdaging te spelen. " + a + " van de " + n + " accounts zijn er al: die van jou telt mee.",
    fr: (a: string, n: string) => "Crée un compte gratuit pour jouer au défi du mois et au Super défi. " + a + " comptes sur " + n + " sont déjà là : le tien compte aussi.",
    es: (a: string, n: string) => "Crea una cuenta gratis para jugar el reto mensual y el Super reto. Ya hay " + a + " de " + n + " cuentas: la tuya también suma.",
    it: (a: string, n: string) => "Crea un account gratuito per giocare la sfida mensile e la Super sfida. Ci sono già " + a + " account su " + n + ": anche il tuo conta.",
    tr: (a: string, n: string) => "Aylık ve Süper meydan okumayı oynamak için ücretsiz bir hesap oluştur. " + n + " hesabın " + a + " tanesi hazır: seninki de sayılır.",
    ja: (a: string, n: string) => "無料アカウントを作って、マンスリーとスーパーに参加しよう。" + n + "アカウント中" + a + "まで来たよ。あなたの分もカウントされる。",
    zh: (a: string, n: string) => "创建免费账号，参加每月挑战和超级挑战。" + n + " 个账号已有 " + a + " 个：你的也算一个。",
    tw: (a: string, n: string) => "建立免費帳號，參加每月挑戰和超級挑戰。" + n + " 個帳號已有 " + a + " 個：你的也算一個。",
  },
  // ...once the challenges are open
  acctOpen: { en: "🏆 The JAVEDA challenges are open", nl: "🏆 De JAVEDA-uitdagingen zijn begonnen", fr: "🏆 Les défis JAVEDA sont ouverts",
    es: "🏆 Los retos de JAVEDA ya están abiertos", it: "🏆 Le sfide JAVEDA sono aperte", tr: "🏆 JAVEDA meydan okumaları açıldı",
    ja: "🏆 JAVEDAチャレンジが始まったよ", zh: "🏆 JAVEDA 挑战开始了", tw: "🏆 JAVEDA 挑戰開始了" },
  acctOpenBody: {
    en: "Create a free account to play the Monthly and the Super, with prizes for the top three.",
    nl: "Maak een gratis account om de maanduitdaging en de Superuitdaging te spelen, met prijzen voor de top drie.",
    fr: "Crée un compte gratuit pour jouer au défi du mois et au Super défi, avec des prix pour les trois premiers.",
    es: "Crea una cuenta gratis para jugar el reto mensual y el Super reto, con premios para los tres primeros.",
    it: "Crea un account gratuito per giocare la sfida mensile e la Super sfida, con premi per i primi tre.",
    tr: "Aylık ve Süper meydan okumayı oynamak için ücretsiz bir hesap oluştur; ilk üçe ödüller var.",
    ja: "無料アカウントを作って、マンスリーとスーパーに参加しよう。上位3人には賞品も。",
    zh: "创建免费账号，参加每月挑战和超级挑战，前三名有奖品。",
    tw: "建立免費帳號，參加每月挑戰和超級挑戰，前三名有獎品。",
  },
};
const L = (s: Sub): Lang => (["en", "nl", "fr", "es", "it", "tr", "ja", "zh", "tw"].includes(s.lang) ? s.lang : "en");
const LOCALE = { en: "en-GB", nl: "nl-BE", fr: "fr-BE", es: "es-ES", it: "it-IT", tr: "tr-TR", ja: "ja-JP", zh: "zh-CN", tw: "zh-TW" };
// "Level 3" - in Chinese "第3关" / "第3關"
const levelName = (l: Lang, num: number, title: string, endless = false) =>
  (l === "zh" ? "第" + num + "关" : l === "tw" ? "第" + num + "關" : W.level[l] + (l === "ja" ? "" : " ") + num) + " · " + title + (endless ? " ∞" : "");

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

  // the chat: a mention first (with its words), else the reactions (with the words they're on)
  const { data: chat, error: e3 } = await db.rpc("javeda_push_chat_take");
  if (e3) return json({ ...out, error: e3.message }, 500);
  const quote = (t: string | null) => t ? "\u201c" + (t.length > 120 ? t.slice(0, 119) + "\u2026" : t) + "\u201d" : "";
  out.chat = await sendAll((chat ?? []) as Chat[], s => {
    const l = L(s);
    return s.mentions
      ? { title: W.mention[l](s.m_by || W.someone[l]), body: quote(s.m_body), url: "/javeda/#chat", tag: "javeda-chat" }
      : { title: W.react[l](s.r_by || W.someone[l], Math.max(0, s.people - 1), s.emojis || ""), body: quote(s.r_body), url: "/javeda/#chat", tag: "javeda-chat" };
  }, 6 * 3600);

  // once: "Join the JAVEDA challenges" to the phones with no account (a database without it yet: skipped, not an error)
  const { data: acct, error: e4 } = await db.rpc("javeda_push_acct_due");
  if (e4) out.acct = { skipped: e4.message.slice(0, 120) };
  else if (acct) out.acct = await sendAll((acct.subs ?? []) as Sub[], s => {
    const l = L(s), f = (x: number) => new Intl.NumberFormat(LOCALE[l]).format(x ?? 0);
    return acct.open ? { title: W.acctOpen[l], body: W.acctOpenBody[l], url: "/javeda/#join", tag: "javeda-acct" }
      : { title: W.acct[l], body: W.acctBody[l](f(acct.accounts), f(acct.need)), url: "/javeda/#join", tag: "javeda-acct" };
  }, 12 * 3600);

  return json(out);
});
