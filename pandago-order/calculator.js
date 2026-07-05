/* ═══════════════════════════════════════════════════════════════
   PandaGo Cargo · Калькулятор стоимости под ключ

   Формула: Math.ceil((usd + ship) * rate / 1000) * 1000
   Экономия: цена дилера принимается как цена PandaGo * 1.6
   Результат перетекает в форму заявки (поле service).
   ═══════════════════════════════════════════════════════════════ */

import {
  CATALOG, CAT_LABELS, CAT_ORDER, RATE,
  fmt, priceRub, dealerRub,
} from './catalog-data.js';

const CAT_ICONS = {
  quad:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 12h8M6 15l-3 3M18 15l3 3M6 8c0-1.5 1-3 3-3h6c2 0 3 1.5 3 3v4H6V8z"/><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/></svg>',
  moto:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M14 17H8l-2-5h8l2 5zM14 12l2-5h3M8 12L6 7"/></svg>',
  jet:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M4 13l3-7 5 3 5-3 3 7M8 6l2 3M14 6l-2 3"/></svg>',
  buggy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13l2-4h14l2 4v4h-3M3 13v4h3M9 17h6"/><circle cx="6" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><path d="M5 9l1-3h12l1 3"/></svg>',
  snow:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 17h2l3-5h10l3 5h2M6 12V7h12v5M9 17v-3M15 17v-3"/></svg>',
  equip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 10v6M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m10 0h6M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24"/></svg>',
};

const REGIONS = [
  { k: 'msk',   t: 'Москва / МО' },
  { k: 'spb',   t: 'Санкт-Петербург' },
  { k: 'south', t: 'Юг РФ' },
  { k: 'other', t: 'Другой регион' },
];

export const Calc = {
  state: {
    cat: 'moto',
    model: null,
    region: 'msk',
    search: '',
  },
  els: {},
  trackedUse: false,
  onUse: null,      /* колбэк trackEvent('calc_use') */
  onOrder: null,    /* колбэк переноса результата в форму */

  init({ onUse, onOrder } = {}) {
    this.onUse = onUse;
    this.onOrder = onOrder;
    this.els = {
      cats:    document.getElementById('calcCats'),
      search:  document.getElementById('calcSearch'),
      models:  document.getElementById('calcModels'),
      regions: document.getElementById('calcRegions'),
      name:    document.getElementById('calcModelName'),
      numVal:  document.getElementById('calcNumVal'),
      num:     document.getElementById('calcNum'),
      cap:     document.getElementById('calcCap'),
      save:    document.getElementById('calcSave'),
      saveVal: document.getElementById('calcSaveVal'),
      breaks:  document.getElementById('calcBreak'),
      cta:     document.getElementById('calcCta'),
    };
    if (!this.els.cats || !this.els.models) return;

    /* стартовая модель: Sur-Ron Ultra Bee, узнаваемый бестселлер */
    this.state.model = CATALOG.moto.find((m) => m.name === 'Sur-Ron Ultra Bee') || CATALOG.moto[0];

    this.renderCats();
    this.renderRegions();
    this.renderModels();
    this.renderResult(false);

    this.els.search.addEventListener('input', () => {
      this.state.search = this.els.search.value;
      this.renderModels();
    });
    this.els.cta.addEventListener('click', () => this.order());
  },

  setCat(k) {
    if (this.state.cat === k) return;
    this.state.cat = k;
    this.state.model = null;
    this.state.search = '';
    this.els.search.value = '';
    this.renderCats();
    this.renderModels();
    this.renderResult(false);
  },

  setModel(name) {
    const m = (CATALOG[this.state.cat] || []).find((x) => x.name === name);
    if (!m) return;
    this.state.model = m;
    this.renderModels();
    this.renderResult(true);
    if (!this.trackedUse && this.onUse) {
      this.trackedUse = true;
      this.onUse();
    }
  },

  setRegion(k) {
    this.state.region = k;
    this.renderRegions();
  },

  renderCats() {
    this.els.cats.innerHTML = CAT_ORDER.map((k) => `
      <button type="button" class="chip ${this.state.cat === k ? 'on' : ''}" data-cat="${k}">
        ${CAT_ICONS[k]}<span>${CAT_LABELS[k].t}</span>
      </button>`).join('');
    this.els.cats.querySelectorAll('[data-cat]').forEach((b) => {
      b.addEventListener('click', () => this.setCat(b.dataset.cat));
    });
  },

  renderRegions() {
    this.els.regions.innerHTML = REGIONS.map((r) => `
      <button type="button" class="chip ${this.state.region === r.k ? 'on' : ''}" data-region="${r.k}">
        <span>${r.t}</span>
      </button>`).join('');
    this.els.regions.querySelectorAll('[data-region]').forEach((b) => {
      b.addEventListener('click', () => this.setRegion(b.dataset.region));
    });
  },

  renderModels() {
    const list = CATALOG[this.state.cat] || [];
    const q = this.state.search.toLowerCase().trim();
    const filtered = q ? list.filter((m) => m.name.toLowerCase().includes(q)) : list;

    if (!filtered.length) {
      this.els.models.innerHTML = '<div class="model-empty">Нужной модели пока нет в списке. Оставьте заявку, привезём под заказ.</div>';
      return;
    }
    this.els.models.innerHTML = filtered.map((m) => {
      const on = this.state.model && this.state.model.name === m.name ? 'on' : '';
      const rub = priceRub(m);
      const price = rub
        ? `<span class="model-price">от ${fmt(rub)} ₽</span>`
        : '<span class="model-price req">по запросу</span>';
      return `<button type="button" class="model-item ${on}" role="option" aria-selected="${on ? 'true' : 'false'}" data-model="${m.name.replace(/"/g, '&quot;')}">
        <span>${m.name}</span>${price}
      </button>`;
    }).join('');
    this.els.models.querySelectorAll('[data-model]').forEach((b) => {
      b.addEventListener('click', () => this.setModel(b.dataset.model));
    });
  },

  renderResult(animate) {
    const m = this.state.model;

    if (!m) {
      this.els.name.textContent = 'Выберите модель из списка';
      this.els.numVal.textContent = 'от ' + fmt(this.minPrice());
      this.els.cap.textContent = 'Стартовая цена в категории «' + CAT_LABELS[this.state.cat].t + '»';
      this.els.save.hidden = true;
      this.els.breaks.innerHTML = '';
      this.els.cta.textContent = 'Получить точный расчёт';
      return;
    }

    const rub = priceRub(m);
    this.els.name.textContent = m.name;

    if (!rub) {
      this.els.numVal.textContent = 'По запросу';
      this.els.cap.textContent = 'Позиция считается индивидуально: пришлём цифру после заявки';
      this.els.save.hidden = true;
      this.els.breaks.innerHTML = '';
      this.els.cta.textContent = 'Запросить цену';
      return;
    }

    this.els.cap.textContent = 'Цена под ключ с таможней и доставкой до двери';
    this.els.cta.textContent = 'Получить точный расчёт';

    const dealer = dealerRub(rub);
    const saved = dealer - rub;
    this.els.save.hidden = false;
    this.els.saveVal.textContent = `Экономия ${fmt(saved)} ₽ против дилера`;

    const rows = [];
    if (m.usd)  rows.push(['Закупка на фабрике', '$' + fmt(m.usd)]);
    if (m.ship) rows.push(['Логистика и таможня', '$' + fmt(m.ship)]);
    rows.push(['Курс расчёта', RATE + ' ₽ / USD']);
    rows.push(['У дилера в РФ', 'от ' + fmt(dealer) + ' ₽']);
    this.els.breaks.innerHTML = rows.map(([l, v]) =>
      `<div class="calc-break-row"><span>${l}</span><b>${v}</b></div>`).join('');

    if (animate) {
      this.countTo(rub);
      this.els.num.classList.remove('flash');
      requestAnimationFrame(() => this.els.num.classList.add('flash'));
      clearTimeout(this._flashT);
      this._flashT = setTimeout(() => this.els.num.classList.remove('flash'), 900);
    } else {
      this.els.numVal.textContent = 'от ' + fmt(rub);
    }
  },

  /* Плавный подсчёт цифры без внешних библиотек */
  countTo(target) {
    cancelAnimationFrame(this._raf);
    const startText = this.els.numVal.textContent.replace(/[^\d]/g, '');
    const from = parseInt(startText, 10) || 0;
    const t0 = performance.now();
    const dur = 700;
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (target - from) * eased);
      this.els.numVal.textContent = 'от ' + fmt(Math.round(v / 1000) * 1000);
      if (p < 1) this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  },

  minPrice() {
    const list = (CATALOG[this.state.cat] || [])
      .map((m) => priceRub(m))
      .filter(Boolean);
    return list.length ? Math.min(...list) : 220000;
  },

  order() {
    const m = this.state.model;
    const region = REGIONS.find((r) => r.k === this.state.region);
    const service = m ? m.name : 'Подбор: ' + CAT_LABELS[this.state.cat].t;
    const rub = m ? priceRub(m) : null;
    const msgParts = [
      'Из калькулятора',
      'Категория: ' + CAT_LABELS[this.state.cat].t,
      m ? 'Модель: ' + m.name : '',
      rub ? `Ориентир: от ${fmt(rub)} ₽ под ключ` : (m ? 'Цена по запросу' : ''),
      region ? 'Регион: ' + region.t : '',
    ].filter(Boolean).join(' · ');

    if (this.onOrder) this.onOrder({ service, msg: msgParts });
  },
};
