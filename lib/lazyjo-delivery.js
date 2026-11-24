// "Your record has landed": the email a Universe buyer gets once, right after paying.
// Plain inline-styled HTML (email clients), dark Universe look, the song's own accent colour.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function deliveryEmailHtml({ title, artist, coverUrl, downloadUrl, javedaUrl, universeUrl, supporterNo, records, accent = '#22d3ee', name }) {
  const no = supporterNo ? `#${String(supporterNo).padStart(3, '0')}` : null;
  const recs = records ? `${records} ${records === 1 ? 'record' : 'records'} in your collection` : null;
  const hi = name ? `${esc(name)}, it` : 'It';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#030712">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#030712;background-image:radial-gradient(ellipse at 50% 0%, #1b1046 0%, #030712 70%)">
<tr><td align="center" style="padding:36px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:Helvetica,Arial,sans-serif;color:#e8f6ff">
  <tr><td align="center" style="padding-bottom:22px;font-size:12px;letter-spacing:4px;color:#9fe9ff;font-weight:700">LAZY JO&rsquo;S UNIVERSE</td></tr>
  <tr><td align="center" style="padding-bottom:8px;font-size:13px;letter-spacing:3px;color:${esc(accent)};font-weight:700">TRANSMISSION RECEIVED</td></tr>
  <tr><td align="center" style="padding-bottom:26px;font-size:30px;line-height:1.15;font-weight:800;color:#ffffff">Your record has landed</td></tr>
  <tr><td align="center" style="padding-bottom:24px">
    <img src="${esc(coverUrl)}" width="300" height="300" alt="${esc(title)} cover" style="display:block;width:300px;max-width:80%;height:auto;border-radius:10px;border:1px solid ${esc(accent)};box-shadow:0 0 40px ${esc(accent)}66">
  </td></tr>
  <tr><td align="center" style="padding-bottom:4px;font-size:24px;font-weight:800;color:#ffffff">${esc(title)}</td></tr>
  <tr><td align="center" style="padding-bottom:22px;font-size:15px;color:#9fb3d1">${esc(artist)}</td></tr>
  <tr><td align="center" style="padding:0 10px 26px;font-size:16px;line-height:1.55;color:#d6e4f5">${hi}&rsquo;s yours, forever. Thank you for supporting Lazy Jo directly: this goes straight to the music.</td></tr>
  <tr><td align="center" style="padding-bottom:12px">
    <a href="${esc(downloadUrl)}" style="display:inline-block;background:${esc(accent)};color:#05070d;font-weight:800;font-size:16px;text-decoration:none;padding:16px 30px;border-radius:999px">Download your WAV</a>
  </td></tr>
  <tr><td align="center" style="padding-bottom:30px;font-size:13px;color:#7d8bb0">This link is yours forever. Keep this email to download it again anytime.</td></tr>
  ${no ? `<tr><td align="center" style="padding-bottom:26px">
    <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px solid ${esc(accent)}88;border-radius:14px;background:#0b1024"><tr><td align="center" style="padding:16px 26px">
      <div style="font-size:11px;letter-spacing:4px;color:#9fb3d1;font-weight:700">SUPPORTER</div>
      <div style="font-size:34px;font-weight:800;color:#ffffff;letter-spacing:1px">${no}</div>
      ${recs ? `<div style="font-size:13px;font-weight:700;letter-spacing:2px;color:${esc(accent)};padding-bottom:6px">${esc(recs.toUpperCase())}</div>` : ''}
      <div style="font-size:13px;color:#9fb3d1">Your supporter card is waiting on the download page. Share it in your story.</div>
    </td></tr></table>
  </td></tr>` : ''}
  <tr><td align="center" style="padding:0 10px 28px;font-size:14px;line-height:1.55;color:#c9b8f5">&#9889; Play <a href="${esc(javedaUrl)}" style="color:#d8b4fe;font-weight:700">JAVEDA</a> with an account on this email and you get the supporter badge, and you&rsquo;re always invited to the Super challenges.</td></tr>
  <tr><td align="center" style="font-size:12px;color:#5d6b8a">Lazy Jo &middot; <a href="${esc(universeUrl)}" style="color:#5d6b8a">lightningwolves.studio/lazyjo</a></td></tr>
</table>
</td></tr></table></body></html>`;
}

module.exports = { deliveryEmailHtml };
