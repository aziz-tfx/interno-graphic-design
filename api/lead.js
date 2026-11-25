// Vercel Function: заявка с лендинга «Графический дизайн» → amoCRM через форму amoForms 1751306
// (та же форма, что у хоумпейджа: воронка, ответственный и теги настраиваются в amoCRM).
// Курс, канал связи и UTM пишутся в название сделки и примечание — так менеджер и отчёты
// видят, с какого лендинга и объявления пришёл лид.
const AMO = {
  server: 'https://forms.amo-forms.ru',
  formId: '1751306',
  hash: '4549f2f048329fb3c80e459b5b469bee',
};
const AMO_FIELDS = { name: 'fields[name_1]', phone: 'fields[875427_1][1182433]', note: 'fields[note_2]' };
const COURSE = 'Графический дизайн';
const TIMEOUT_MS = 8000;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'ttclid'];
const s = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// +998 XX XXX XX XX: принимаем 9 цифр без кода страны, 998XXXXXXXXX и с плюсом
function normPhone(raw) {
  const d = s(raw, 40).replace(/\D/g, '');
  if (/^998\d{9}$/.test(d)) return '+' + d;
  if (/^\d{9}$/.test(d)) return '+998' + d;
  return '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  if (s(body.website)) return res.status(200).json({ ok: true }); // honeypot

  const name = s(body.name, 100);
  const contact = s(body.phone, 60);
  const phone = normPhone(contact);
  const tg = /^@[\w\d_]{3,}$/.test(contact) ? contact : '';
  const email = s(body.email, 120);
  if (name.length < 2 || (!phone && !tg)) {
    return res.status(400).json({ ok: false, error: 'invalid_input' });
  }

  const utm = body.utm && typeof body.utm === 'object' ? body.utm : {};
  const utmPairs = UTM_KEYS.map((k) => (s(utm[k], 200) ? `${k}=${s(utm[k], 200)}` : null)).filter(Boolean);
  const note = [
    `Курс: ${COURSE}`,
    tg && `Telegram: ${tg}`,
    email && `Почта: ${email}`,
    utmPairs.length && `UTM: ${utmPairs.join(' · ')}`,
    s(body.page, 300) && `Страница: ${s(body.page, 300)}`,
  ].filter(Boolean).join('\n');

  const id = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
  const fd = new FormData();
  fd.append(AMO_FIELDS.name, `${name} · ${COURSE}`);
  fd.append(AMO_FIELDS.phone, phone);
  fd.append(AMO_FIELDS.note, note);
  fd.append('form_id', AMO.formId);
  fd.append('hash', AMO.hash);
  fd.append('user_origin', '{}');
  fd.append('form_request_id', id);

  try {
    const r = await fetch(`${AMO.server}/queue/add`, { method: 'POST', body: fd, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = await r.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}
    if (!r.ok || data.error_code !== 0) throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
    console.log('LEAD_OK', JSON.stringify({ id, course: COURSE, phone, tg, utm: utmPairs.join(' · ') }));
    return res.status(200).json({ ok: true, id });
  } catch (err) {
    console.error('lead: amo failed:', err && err.message);
    return res.status(502).json({ ok: false, error: 'amo_failed' });
  }
};
