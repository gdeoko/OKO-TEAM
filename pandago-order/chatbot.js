/* ═══════════════════════════════════════════════════════════════
   PandaGo Cargo · Чат-виджет «Панда»

   Диалоговое дерево из версии 1.1 (проверено на соответствие
   правилам текста) плюс новая ветка: сбор контакта прямо в чате
   и отправка заявки в api.php?action=newLead.
   ═══════════════════════════════════════════════════════════════ */

const I = {
  quad:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 12h8M6 15l-3 3M18 15l3 3M6 8c0-1.5 1-3 3-3h6c2 0 3 1.5 3 3v4H6V8z"/><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/></svg>',
  moto:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M14 17H8l-2-5h8l2 5zM14 12l2-5h3M8 12L6 7"/></svg>',
  jet:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M4 13l3-7 5 3 5-3 3 7M8 6l2 3M14 6l-2 3"/></svg>',
  buggy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13l2-4h14l2 4v4h-3M3 13v4h3M9 17h6"/><circle cx="6" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><path d="M5 9l1-3h12l1 3"/></svg>',
  equip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 10v6M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m10 0h6M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24"/></svg>',
  calc:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  b2b:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 12h.01M15 12h.01M9 15h.01M15 15h.01M9 18h.01M15 18h.01"/></svg>',
  info:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  tg:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4.5L2.5 12l6.5 2 2 6.5L21.5 4.5zM10 15l-1.5-5 10-4.5L10 15z"/></svg>',
  send:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
};

export const Chat = {
  open: false,
  started: false,
  history: [],
  leadMode: null,        /* null | 'name' | 'contact' */
  lead: { name: '', contact: '' },
  onOpen: null,          /* колбэк trackEvent('chat_open') */
  submitLead: null,      /* функция отправки заявки, передаётся из app.js */

  init({ onOpen, submitLead } = {}) {
    this.onOpen = onOpen;
    this.submitLead = submitLead;
    const btn   = document.getElementById('cwBtn');
    const close = document.getElementById('cwClose');
    const send  = document.getElementById('cwSend');
    const input = document.getElementById('cwInput');
    if (!btn || !close || !send || !input) return;

    btn.addEventListener('click', () => this.toggle());
    close.addEventListener('click', () => this.close());
    send.addEventListener('click', () => this.userSend());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.userSend();
    });

    setTimeout(() => {
      if (this.open) return;
      try {
        if (!sessionStorage.getItem('cwSeen')) {
          const badge = document.getElementById('cwBadge');
          if (badge) badge.style.display = 'flex';
        }
      } catch (e) {}
    }, 25000);
  },

  toggle() { this.open ? this.close() : this.openIt(); },

  openIt() {
    this.open = true;
    const panel = document.getElementById('cwPanel');
    const badge = document.getElementById('cwBadge');
    if (panel) panel.classList.add('open');
    if (badge) badge.style.display = 'none';
    try { sessionStorage.setItem('cwSeen', '1'); } catch (e) {}
    if (!this.started) {
      this.started = true;
      if (this.onOpen) this.onOpen();
      this.start();
    }
  },

  close() {
    this.open = false;
    const panel = document.getElementById('cwPanel');
    if (panel) panel.classList.remove('open');
  },

  async start() {
    await this.bot('Здравствуйте! Меня зовут Панда, я виртуальный менеджер PandaGo. Помогу разобраться с доставкой техники из Китая и подобрать вариант под вашу задачу.');
    await this.wait(400);
    await this.bot('Что вас интересует?');
    this.quick([
      { t: 'Квадроцикл или мотоцикл',  ico: I.quad,  go: 'v_quad' },
      { t: 'Гидроцикл',                ico: I.jet,   go: 'v_jet' },
      { t: 'Багги или снегоход',       ico: I.buggy, go: 'v_buggy' },
      { t: 'Оборудование для бизнеса', ico: I.equip, go: 'v_equip' },
      { t: 'Просто спросить',          ico: I.info,  go: 'v_ask' },
    ]);
  },

  async v_quad() {
    await this.user('Квадроцикл или мотоцикл');
    await this.bot('Отличный выбор. В наличии для расчёта <b>CFmoto, LONCIN, Polaris, Yamaha, Honda, Sur-Ron</b> и другие. Что ближе по задаче?');
    this.quick([
      { t: 'Для покатушек и хобби', ico: I.moto,  go: 'v_hobby' },
      { t: 'Для перепродажи',       ico: I.b2b,   go: 'v_resell' },
      { t: 'Электро и Sur-Ron',     ico: I.moto,  go: 'v_electro' },
      { t: 'Открыть калькулятор',   ico: I.calc,  go: 'v_calc' },
    ]);
  },

  async v_jet() {
    await this.user('Гидроцикл');
    await this.bot('Гидро наша топ-категория. Возим напрямую <b>Sea-Doo, Kawasaki, Yamaha</b>. Например Sea-Doo GTI 170 от 1 835 000 ₽ под ключ. Sea-Doo Spark 3up от 973 000 ₽. Yamaha VX Deluxe от 1 253 000 ₽.');
    await this.wait(400);
    await this.bot('Хотите точный расчёт под конкретную модель?');
    this.quick([
      { t: 'Открыть калькулятор',    ico: I.calc,  go: 'v_calc' },
      { t: 'Оставить заявку в чате', ico: I.send,  go: 'v_lead' },
      { t: 'Сколько идёт по срокам', ico: I.clock, go: 'v_time' },
    ]);
  },

  async v_buggy() {
    await this.user('Багги или снегоход');
    await this.bot('Возим и то, и другое. По багги популярно <b>Desertcross 1000-3, CFmoto UForce, BRP Can-Am Maverick</b>. По снегоходам работаем под задачу, скажите какой регион и стиль катания. Цена под ваш вариант считается индивидуально.');
    this.quick([
      { t: 'Оставить заявку в чате', ico: I.send, go: 'v_lead' },
      { t: 'Открыть калькулятор',    ico: I.calc, go: 'v_calc' },
    ]);
  },

  async v_equip() {
    await this.user('Оборудование для бизнеса');
    await this.bot('С B2B работаем регулярно. Возим <b>CNC-станки, лазерную резку, прессы, промышленную технику</b>. Полный пакет документов для юрлиц. Доставка крупногабарита обычно 40-60 дней.');
    await this.wait(400);
    await this.bot('Что нужно привезти?');
    this.quick([
      { t: 'Оставить запрос в чате', ico: I.send, go: 'v_lead' },
      { t: 'Написать менеджеру',     ico: I.tg,   go: 'v_manager' },
    ]);
  },

  async v_ask() {
    await this.user('Просто спросить');
    await this.bot('Спрашивайте. Отвечу на всё что касается доставки из Китая. Или напишите вопрос в свободной форме.');
    this.quick([
      { t: 'Сколько идёт по срокам', ico: I.clock,  go: 'v_time' },
      { t: 'Входит ли таможня',      ico: I.shield, go: 'v_customs' },
      { t: 'Какие гарантии',         ico: I.shield, go: 'v_warranty' },
      { t: 'Работаете с юрлицами',   ico: I.b2b,    go: 'v_b2b' },
    ]);
  },

  async v_hobby() {
    await this.user('Для покатушек и хобби');
    await this.bot('Для катания топ-3 у нас: <b>CFmoto CFORCE 800 HO</b> (от 1 283 000 ₽), <b>LONCIN XWOLF 700L</b> (от 738 000 ₽) и <b>Yamaha Grizzly 700</b> (от 1 323 000 ₽) под ключ. Все надёжные, ходовые, с гарантией.');
    await this.wait(400);
    await this.bot('Оставите контакт и пришлём расчёт с полной раскладкой цены за 15 минут.');
    this.quick([
      { t: 'Оставить заявку в чате', ico: I.send, go: 'v_lead' },
      { t: 'Открыть калькулятор',    ico: I.calc, go: 'v_calc' },
    ]);
  },

  async v_resell() {
    await this.user('Для перепродажи');
    await this.bot('Понимаем. Для перепродажи важна маржа, поэтому от 2 единиц оптовые условия, документы для постановки на учёт готовы к получению, при партии 5+ единиц специальная цена. Маржа получается 15-25% к рыночной цене в РФ.');
    await this.wait(400);
    await this.bot('Что планируете возить?');
    this.quick([
      { t: 'Квадроциклы (2-5 единиц)', ico: I.quad, go: 'v_lead' },
      { t: 'Мотоциклы Sur-Ron',        ico: I.moto, go: 'v_electro' },
      { t: 'Обсудить с менеджером',    ico: I.tg,   go: 'v_manager' },
    ]);
  },

  async v_electro() {
    await this.user('Электро и Sur-Ron');
    await this.bot('Sur-Ron у нас топ. <b>Light Bee X</b> от 220 000 ₽, <b>Ultra Bee</b> от 417 000 ₽, <b>Storm Bee</b> от 566 000 ₽ под ключ. Также Talaria, NIU, Super Soco. Идут быстро, 20 или 25 дней в среднем.');
    this.quick([
      { t: 'Открыть калькулятор',    ico: I.calc, go: 'v_calc' },
      { t: 'Оставить заявку в чате', ico: I.send, go: 'v_lead' },
    ]);
  },

  async v_time() {
    await this.user('Сколько идёт по срокам');
    await this.bot('Средний срок <b>30 дней</b> от оплаты до вашей двери. Электротехника (Sur-Ron, NIU) идёт быстрее, 20-25 дней. Гидроциклы и крупногабарит 35-45 дней. Оборудование для B2B 40-60 дней. Все сроки фиксируются в договоре.');
    this.quick([
      { t: 'Открыть калькулятор',    ico: I.calc, go: 'v_calc' },
      { t: 'Оставить заявку в чате', ico: I.send, go: 'v_lead' },
    ]);
  },

  async v_customs() {
    await this.user('Входит ли таможня');
    await this.bot('Да, всё под ключ. В финальной цене уже закупка на фабрике, логистика Гуанчжоу и Москва через Монголию, таможня, пошлины, сертификация и доставка до вашего адреса. Все расходы <b>зафиксированы в договоре</b>, доплат в процессе не будет.');
    this.quick([
      { t: 'Открыть калькулятор',    ico: I.calc, go: 'v_calc' },
      { t: 'Написать менеджеру',     ico: I.tg,   go: 'v_manager' },
    ]);
  },

  async v_warranty() {
    await this.user('Какие гарантии');
    await this.bot('Работаем по договору. Стоимость и сроки фиксируются до отправки без изменений в процессе. Ответственность за груз на всех этапах на нас. За 6 лет 2400+ поставок. Приёмка на фабрике через нашего представителя. Заводская гарантия сохраняется.');
    this.quick([
      { t: 'Оставить заявку в чате', ico: I.send, go: 'v_lead' },
      { t: 'Написать менеджеру',     ico: I.tg,   go: 'v_manager' },
    ]);
  },

  async v_b2b() {
    await this.user('Работаете с юрлицами');
    await this.bot('Да, работаем с ИП и с ООО. Полный пакет документов: договор, счёт, ТТН, документы для постановки на учёт. Возим партиями, помогаем с сертификацией для продажи в РФ. Расчёт по безналу или крипте (USDT).');
    this.quick([
      { t: 'Оставить B2B-запрос',   ico: I.b2b, go: 'v_lead' },
      { t: 'Обсудить с менеджером', ico: I.tg,  go: 'v_manager' },
    ]);
  },

  async v_calc() {
    await this.user('Открыть калькулятор');
    await this.bot('Открываю. Выберите категорию и модель, увидите ориентировочную цену.');
    setTimeout(() => {
      this.close();
      const el = document.getElementById('calculator');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 700);
  },

  async v_manager() {
    await this.user('Написать менеджеру');
    await this.bot('Открываю Telegram. Живой менеджер ответит в течение нескольких минут.');
    setTimeout(() => window.open('https://t.me/pandaGO_media', '_blank'), 700);
    this.quick([
      { t: 'Ещё вопрос', ico: I.info, go: 'v_ask' },
    ]);
  },

  /* ── Заявка прямо в чате ── */
  async v_lead() {
    await this.user('Оставить заявку в чате');
    await this.bot('Отлично. Как к вам обращаться?');
    this.leadMode = 'name';
    this.focusInput();
  },

  async leadStep(text) {
    if (this.leadMode === 'name') {
      this.lead.name = text;
      this.leadMode = 'contact';
      await this.bot(`Приятно познакомиться, ${text}. Куда прислать расчёт? Напишите телефон, Telegram или email.`);
      this.focusInput();
      return;
    }
    if (this.leadMode === 'contact') {
      if (text.replace(/\D/g, '').length < 6 && !text.includes('@') && text.length < 5) {
        await this.bot('Похоже, контакт неполный. Напишите телефон в формате +7 999 123-45-67, ник в Telegram через @ или email.');
        this.focusInput();
        return;
      }
      this.lead.contact = text;
      this.leadMode = null;
      const summary = this.history
        .filter((h) => h.from === 'u')
        .map((h) => h.t)
        .slice(0, 8)
        .join(' · ');
      let ok = false;
      if (this.submitLead) {
        ok = await this.submitLead({
          name: this.lead.name,
          contact: this.lead.contact,
          service: 'Заявка из чат-бота',
          msg: 'Диалог: ' + summary,
        });
      }
      if (ok) {
        await this.bot('Заявка принята! Менеджер свяжется с вами в течение 15 минут и пришлёт расчёт с раскладкой по позициям.');
      } else {
        await this.bot('Записал ваши данные. Чтобы точно ничего не потерялось, продублируйте, пожалуйста, менеджеру в Telegram.');
      }
      this.quick([
        { t: 'Написать менеджеру', ico: I.tg,   go: 'v_manager' },
        { t: 'Ещё вопрос',         ico: I.info, go: 'v_ask' },
      ]);
    }
  },

  focusInput() {
    const input = document.getElementById('cwInput');
    if (input && window.innerWidth > 700) input.focus();
  },

  async bot(text) {
    const body = document.getElementById('cwBody');
    if (!body) return;
    return new Promise((res) => {
      const typ = document.createElement('div');
      typ.className = 'cw-typing';
      typ.innerHTML = '<span></span><span></span><span></span>';
      body.appendChild(typ);
      body.scrollTop = body.scrollHeight;
      setTimeout(() => {
        typ.remove();
        const msg = document.createElement('div');
        msg.className = 'cw-msg d';
        msg.innerHTML = text;
        body.appendChild(msg);
        body.scrollTop = body.scrollHeight;
        this.history.push({ from: 'd', t: text });
        res();
      }, 550 + Math.random() * 300);
    });
  },

  async user(text) {
    const body = document.getElementById('cwBody');
    if (!body) return;
    const msg = document.createElement('div');
    msg.className = 'cw-msg u';
    msg.textContent = text;
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
    this.history.push({ from: 'u', t: text });
    body.querySelectorAll('.cw-quick').forEach((q) => q.remove());
    return new Promise((res) => setTimeout(res, 150));
  },

  quick(buttons) {
    const body = document.getElementById('cwBody');
    if (!body) return;
    const wrap = document.createElement('div');
    wrap.className = 'cw-quick';
    buttons.forEach((b) => {
      const btn = document.createElement('button');
      btn.className = 'cw-qbtn';
      btn.type = 'button';
      btn.innerHTML = (b.ico || '') + `<span>${b.t}</span>`;
      btn.onclick = () => {
        wrap.remove();
        if (this[b.go]) this[b.go]();
      };
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  },

  async userSend() {
    const input = document.getElementById('cwInput');
    if (!input) return;
    const v = input.value.trim();
    if (!v) return;
    await this.user(v);
    input.value = '';
    await this.wait(400);

    if (this.leadMode) return this.leadStep(v);

    const low = v.toLowerCase();
    if (/цен|стоим|скольк.*стои/.test(low)) return this.v_calc();
    if (/срок|быстр|долг|скольк.*ид|идут/.test(low)) return this.v_time();
    if (/таможн|растаможк|пошлин/.test(low)) return this.v_customs();
    if (/гаранти|надёжн|надежн|обман|кинут/.test(low)) return this.v_warranty();
    if (/ооо|ип|юрлиц|юр\.?\s*лиц|b2b|безнал/.test(low)) return this.v_b2b();
    if (/квадр|атв|atv/.test(low)) return this.v_quad();
    if (/гидр|jet|sea.?doo|kawasaki|yamaha/.test(low)) return this.v_jet();
    if (/багг|снегох|снего/.test(low)) return this.v_buggy();
    if (/оборуд|станок|cnc/.test(low)) return this.v_equip();
    await this.bot('Понял. Такие вопросы лучше решать напрямую с менеджером, он ответит за пару минут в Telegram. Либо оставьте заявку прямо здесь.');
    this.quick([
      { t: 'Оставить заявку в чате', ico: I.send, go: 'v_lead' },
      { t: 'Написать менеджеру',     ico: I.tg,   go: 'v_manager' },
      { t: 'Другой вопрос',          ico: I.info, go: 'v_ask' },
    ]);
  },

  wait(ms) { return new Promise((r) => setTimeout(r, ms)); },
};
