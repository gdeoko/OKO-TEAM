/* ═══════════════════════════════════════════════════════════
   PandaGo · Admin Panel Client
   ═══════════════════════════════════════════════════════════ */

const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

const TOKEN_KEY = 'pandago_admin_token';
let TOKEN = null;
let STATE = { leads: [], filter: 'all', search: '', promos: [], events: [], rate: 95, rateUpdate: 0, counts: {} };

/* ─── Utilities ─── */
function fmtDate(ts){
  if (!ts) return '-';
  const d = new Date(ts*1000);
  const pad = n => String(n).padStart(2,'0');
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtTime(ts){
  if (!ts) return '';
  const d = new Date(ts*1000);
  const pad = n => String(n).padStart(2,'0');
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `сегодня ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function toast(msg, err=false){
  const t = $('#toast'); t.textContent = msg;
  t.classList.toggle('err', !!err); t.classList.add('on');
  setTimeout(()=>t.classList.remove('on'), 2400);
}

/* ─── API ─── */
async function api(action, body=null, method='GET'){
  const opts = { method, headers: {'X-Admin-Token': TOKEN || ''} };
  if (method === 'POST' || body) {
    opts.method = 'POST';
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body || {});
  }
  const r = await fetch(`api.php?action=${action}`, opts);
  if (r.status === 401) {
    logout();
    throw new Error('unauthorized');
  }
  return r.json();
}

/* ─── Login ─── */
async function tryLogin(token){
  TOKEN = token;
  try {
    const r = await api('getStats');
    if (r.ok) {
      localStorage.setItem(TOKEN_KEY, token);
      $('#loginWrap').style.display = 'none';
      $('#shell').classList.add('on');
      applyStats(r);
      return true;
    }
  } catch (e) {}
  TOKEN = null;
  return false;
}
function logout(){
  TOKEN = null;
  localStorage.removeItem(TOKEN_KEY);
  $('#shell').classList.remove('on');
  $('#loginWrap').style.display = 'flex';
  $('#loginInput').value = '';
}

/* ─── Rendering ─── */
function applyStats(r){
  STATE.leads   = r.leads   || [];
  STATE.promos  = r.promos  || [];
  STATE.events  = r.events  || [];
  STATE.rate    = r.rate    ?? 95;
  STATE.counts  = r.counts  || {};

  $('#rateBadge').textContent = STATE.rate + ' ₽';
  $('#cntToday').textContent    = STATE.counts.today    || 0;
  $('#cntWeek').textContent     = STATE.counts.week     || 0;
  $('#cntMonth').textContent    = STATE.counts.month    || 0;
  $('#cntNew').textContent      = STATE.counts.new      || 0;
  $('#cntProgress').textContent = STATE.counts.in_progress || 0;
  $('#cntDone').textContent     = STATE.counts.done     || 0;

  $('#rateInput').value    = STATE.rate;
  $('#rateUpdated').value  = fmtDate(r.rate_update_ts || 0);

  renderLeads();
  renderPromos();
  renderEvents();
}

function renderLeads(){
  const list = $('#leadsList');
  const q = STATE.search.trim().toLowerCase();
  let items = STATE.leads;
  if (STATE.filter !== 'all') items = items.filter(l => (l.status || 'new') === STATE.filter);
  if (q) items = items.filter(l => {
    const hay = [l.id, l.name, l.phone, l.tg, l.email, l.service].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });

  if (!items.length) {
    list.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <p>Заявок нет</p>
    </div>`;
    return;
  }

  list.innerHTML = items.map(l => {
    const contact = l.phone
      ? `<a href="tel:${l.phone}">${escapeHtml(l.phone)}</a>`
      : l.tg
        ? `<a href="https://t.me/${l.tg.replace(/^@/,'')}" target="_blank" rel="noopener">${escapeHtml(l.tg)}</a>`
        : l.email
          ? `<a href="mailto:${l.email}">${escapeHtml(l.email)}</a>`
          : '';
    return `
    <div class="lead" data-id="${l.id}">
      <div>
        <div class="lead-id">${escapeHtml(l.id)}</div>
        <div class="lead-time">${fmtTime(l.ts)}</div>
      </div>
      <div class="lead-main">
        <div class="lead-name">${escapeHtml(l.name || 'Без имени')}</div>
        <div class="lead-contact">${contact}</div>
        <div class="lead-service">${escapeHtml(l.service || '')}</div>
      </div>
      <div class="lead-actions">
        <span class="status ${l.status || 'new'}">${statusLabel(l.status)}</span>
        <button class="mini-btn" data-open="${l.id}">Открыть</button>
      </div>
    </div>`;
  }).join('');

  $$('[data-open]', list).forEach(b => {
    b.addEventListener('click', () => openLead(b.dataset.open));
  });
}

function statusLabel(s){
  return ({new:'Новая', in_progress:'В работе', done:'Закрыта', trash:'Корзина'})[s] || 'Новая';
}

function openLead(id){
  const l = STATE.leads.find(x => x.id === id);
  if (!l) return;
  $('#leadModalTitle').textContent = `Заявка · ${l.id}`;

  const contactHtml = [
    l.phone && `<div>Тел: <a href="tel:${l.phone}">${escapeHtml(l.phone)}</a></div>`,
    l.tg    && `<div>TG: <a href="https://t.me/${l.tg.replace(/^@/,'')}" target="_blank">${escapeHtml(l.tg)}</a></div>`,
    l.email && `<div>Email: <a href="mailto:${l.email}">${escapeHtml(l.email)}</a></div>`,
  ].filter(Boolean).join('');

  const notes = (l.notes || []).map(n => `
    <div class="note">
      ${escapeHtml(n.text)}
      <div class="note-meta">${fmtDate(n.ts)} · ${escapeHtml(n.author || 'admin')}</div>
    </div>`).join('') || '<p style="color:var(--text3);font-size:13px">Заметок нет</p>';

  $('#leadModalBody').innerHTML = `
    <div style="margin-bottom:16px">
      <div style="font-weight:600;font-size:16px;margin-bottom:6px">${escapeHtml(l.name || 'Без имени')}</div>
      <div style="font-size:13px;color:var(--text2);line-height:1.7">${contactHtml}</div>
    </div>
    <div style="background:var(--bg);padding:12px 14px;border-radius:10px;margin-bottom:16px;font-size:13px">
      <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Запрос</div>
      ${escapeHtml(l.msg || l.service || '-').replace(/\n/g,'<br>')}
    </div>

    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Статус</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${['new','in_progress','done','trash'].map(s => `
          <button class="chip ${l.status===s?'on':''}" data-status="${s}">${statusLabel(s)}</button>
        `).join('')}
      </div>
    </div>

    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Заметки</div>
      ${notes}
      <div style="display:flex;gap:8px;margin-top:10px">
        <input id="noteInput" placeholder="Новая заметка" style="flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:8px">
        <button class="btn btn-ghost" id="noteAddBtn">Добавить</button>
      </div>
    </div>

    <div style="font-size:12px;color:var(--text3);border-top:1px solid var(--border);padding-top:12px">
      Создана: ${fmtDate(l.ts)}<br>
      IP: ${escapeHtml(l.ip || '-')}<br>
      ${l.ref ? 'Источник: '+escapeHtml(l.ref) : ''}
    </div>

    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-danger" id="deleteBtn">Удалить</button>
      <button class="btn btn-ghost" id="modalCloseBtn" style="margin-left:auto">Закрыть</button>
    </div>
  `;

  $('#leadModal').classList.add('on');

  $$('[data-status]', $('#leadModalBody')).forEach(b => {
    b.addEventListener('click', () => setLeadStatus(l.id, b.dataset.status));
  });
  $('#noteAddBtn').addEventListener('click', () => addLeadNote(l.id));
  $('#deleteBtn').addEventListener('click', () => deleteLead(l.id));
  $('#modalCloseBtn').addEventListener('click', () => $('#leadModal').classList.remove('on'));
}

async function setLeadStatus(id, status){
  const r = await api('adminActions', {op:'setStatus', id, status}, 'POST');
  if (r.ok) { toast('Статус обновлён'); await reload(); openLead(id); }
  else toast('Ошибка: '+(r.err||''), true);
}
async function addLeadNote(id){
  const input = $('#noteInput');
  const note = input.value.trim();
  if (!note) return;
  const r = await api('adminActions', {op:'addNote', id, note, author:'admin'}, 'POST');
  if (r.ok) { input.value=''; toast('Заметка добавлена'); await reload(); openLead(id); }
  else toast('Ошибка', true);
}
async function deleteLead(id){
  if (!confirm('Удалить заявку безвозвратно?')) return;
  const r = await api('adminActions', {op:'delete', id}, 'POST');
  if (r.ok) { $('#leadModal').classList.remove('on'); toast('Удалено'); await reload(); }
  else toast('Ошибка', true);
}

/* ─── Promos ─── */
function renderPromos(){
  const list = $('#promosList');
  if (!STATE.promos.length) {
    list.innerHTML = '<div class="empty"><p>Промокодов нет</p></div>';
    return;
  }
  list.innerHTML = STATE.promos.map((p, i) => `
    <div class="promo-item">
      <div>
        <div class="promo-code">${escapeHtml(p.code)}</div>
        <div class="promo-meta">
          Скидка ${p.discount || 0}% ·
          ${p.label ? escapeHtml(p.label) + ' · ' : ''}
          использован ${p.uses || 0} раз
          ${p.expires ? ' · до '+fmtDate(p.expires) : ''}
        </div>
      </div>
      <button class="mini-btn danger" data-del-promo="${i}">Удалить</button>
    </div>
  `).join('');

  $$('[data-del-promo]', list).forEach(b => {
    b.addEventListener('click', () => deletePromo(parseInt(b.dataset.delPromo, 10)));
  });
}

async function addPromo(){
  const code = $('#promoCode').value.trim().toUpperCase();
  const disc = parseInt($('#promoDisc').value, 10) || 0;
  const label = $('#promoLabel').value.trim();
  const dt = $('#promoExpires').value;
  const expires = dt ? Math.floor(new Date(dt).getTime()/1000) : 0;
  if (!code || !disc) return toast('Введите код и скидку', true);

  const promos = [...STATE.promos, {
    code, discount: disc, type:'percent', label, expires, maxUses:0, uses:0
  }];
  const r = await api('editContent', {key:'_promos', value: JSON.stringify(promos)}, 'POST');
  if (!r.ok) return toast('Ошибка: '+(r.err || ''), true);
  await reload();
  $('#promoCode').value = ''; $('#promoLabel').value = ''; $('#promoExpires').value = '';
  toast('Промокод добавлен');
}
async function deletePromo(i){
  if (!confirm('Удалить промокод?')) return;
  const promos = STATE.promos.filter((_, idx) => idx !== i);
  await api('editContent', {key:'_promos', value: JSON.stringify(promos)}, 'POST');
  await reload();
  toast('Удалён');
}

/* ─── Events ─── */
function renderEvents(){
  const list = $('#eventsList');
  if (!STATE.events.length) {
    list.innerHTML = '<div class="empty"><p>Событий нет</p></div>';
    return;
  }
  list.innerHTML = STATE.events.slice(0, 200).map(e => `
    <div class="event-item">
      <div>
        <div style="font-weight:600;font-size:14px">${escapeHtml(e.type)}</div>
        <div class="promo-meta">${escapeHtml(e.data || '')}</div>
      </div>
      <div style="font-size:12px;color:var(--text3);text-align:right">
        ${fmtTime(e.ts)}<br>${escapeHtml(e.ip || '')}
      </div>
    </div>
  `).join('');
}

/* ─── Rate ─── */
async function saveRate(){
  const rate = parseFloat($('#rateInput').value);
  if (!rate || rate < 30 || rate > 500) return toast('Курс вне диапазона 30..500', true);
  const r = await api('updateRate', {rate}, 'POST');
  if (r.ok) { toast('Курс сохранён'); await reload(); }
  else toast('Ошибка', true);
}

/* ─── Newsletter ─── */
async function sendNewsletter(){
  const text = $('#nlText').value.trim();
  const target = $('#nlTarget').value;
  const limit = parseInt($('#nlLimit').value, 10) || 500;
  if (!text) return toast('Введите текст', true);
  if (!confirm('Отправить рассылку в Telegram?')) return;
  const btn = $('#nlSendBtn');
  btn.disabled = true; btn.textContent = 'Отправка...';
  try {
    const r = await api('sendNewsletter', {text, target, limit}, 'POST');
    if (r.ok) toast(`Отправлено ${r.sent}, ошибок ${r.fail}`);
    else toast('Ошибка: '+(r.err||''), true);
  } finally {
    btn.disabled = false; btn.textContent = 'Отправить';
  }
}

/* ─── Reload ─── */
async function reload(){
  try {
    const r = await api('getStats');
    if (r.ok) applyStats(r);
  } catch (e) {}
}

/* ─── Tabs ─── */
function switchTab(name){
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
  $$('.tab-panel').forEach(p => p.style.display = p.dataset.panel === name ? '' : 'none');
}

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', () => {
  /* login handling */
  $('#loginBtn').addEventListener('click', async () => {
    const val = $('#loginInput').value.trim();
    if (!val) return;
    const ok = await tryLogin(val);
    if (!ok) $('#loginErr').textContent = 'Неверный токен';
  });
  $('#loginInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('#loginBtn').click();
  });

  /* auto-login from storage */
  const saved = localStorage.getItem(TOKEN_KEY);
  if (saved) tryLogin(saved);

  /* logout */
  $('#logoutBtn').addEventListener('click', logout);

  /* tabs */
  $$('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  /* filters */
  $$('[data-flt]').forEach(c => c.addEventListener('click', () => {
    $$('[data-flt]').forEach(x => x.classList.remove('on'));
    c.classList.add('on');
    STATE.filter = c.dataset.flt;
    renderLeads();
  }));

  /* search */
  let searchTimer;
  $('#searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      STATE.search = e.target.value;
      renderLeads();
    }, 200);
  });

  /* refresh */
  $('#refreshBtn').addEventListener('click', reload);

  /* modal close */
  $('#leadModalClose').addEventListener('click', () => $('#leadModal').classList.remove('on'));
  $('#leadModal').addEventListener('click', e => {
    if (e.target.id === 'leadModal') $('#leadModal').classList.remove('on');
  });

  /* promo add */
  $('#promoAddBtn').addEventListener('click', addPromo);

  /* rate save */
  $('#rateSaveBtn').addEventListener('click', saveRate);

  /* newsletter */
  $('#nlSendBtn').addEventListener('click', sendNewsletter);

  /* auto-refresh каждые 60с */
  setInterval(() => { if (TOKEN) reload(); }, 60000);
});
