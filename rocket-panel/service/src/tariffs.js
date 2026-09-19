// Ценовая модель сервиса. Единственный источник правды по деньгам.
// Всё в жетонах; курс к доллару задан здесь и больше нигде.
// Опорный документ: rocket-panel/ВЕБКАМ_ЦЕНЫ.md

/** Сколько жетонов в одном долларе. Курс постоянный и показывается на витрине. */
export const TOKENS_PER_USD = 100;

/** Режимы звонка и ставка за минуту, в жетонах. */
export const CALL_MODES = {
  regular: { id: 'regular', title: 'Обычный', note: 'разговор, сценарии, одетая', launch: 100, standard: 150 },
  hot:     { id: 'hot',     title: 'Горячий', note: 'раздевание, откровенно',    launch: 200, standard: 300 },
  adult:   { id: 'adult',   title: '18+',     note: 'полностью',                 launch: 400, standard: 600 },
};

/**
 * Стартовые ставки действуют до тысячного платящего пользователя. Так
 * объявлено на витрине с первого дня: обещанное заранее повышение люди
 * принимают, внезапное считают обманом.
 */
export const LAUNCH_PRICING_UNTIL_PAYING_USERS = 1000;

/** Тарифы подписки. grant - жетоны, начисляемые при каждом оплаченном месяце. */
export const PLANS = {
  free: {
    id: 'free', title: 'Free', priceUsd: 0, grant: 0,
    messagesPerDay: 40, heroines: 1, photosPerDay: 0,
    voicePerDay: 0, memory: false, priorityQueue: false,
  },
  basic: {
    id: 'basic', title: 'Basic', priceUsd: 20, grant: 1500,
    messagesPerDay: 200, heroines: 5, photosPerDay: 5,
    voicePerDay: 0, memory: true, priorityQueue: false,
  },
  plus: {
    id: 'plus', title: 'Plus', priceUsd: 35, grant: 3000,
    messagesPerDay: 500, heroines: 5, photosPerDay: 10,
    voicePerDay: 20, memory: true, priorityQueue: false,
  },
  vip: {
    id: 'vip', title: 'VIP', priceUsd: 50, grant: 5000,
    messagesPerDay: Infinity, heroines: 5, photosPerDay: 30,
    voicePerDay: Infinity, memory: true, priorityQueue: true,
  },
};

/** Пакеты докупки. Купленные жетоны не сгорают никогда. */
export const TOKEN_PACKS = [
  { id: 'p1',   tokens: 1000,   priceUsd: 10 },
  { id: 'p3',   tokens: 3000,   priceUsd: 27 },
  { id: 'p7',   tokens: 7000,   priceUsd: 56 },
  { id: 'p20',  tokens: 20000,  priceUsd: 140 },
  { id: 'p50',  tokens: 50000,  priceUsd: 325 },
  { id: 'p100', tokens: 100000, priceUsd: 600 },
];

/**
 * Потолок разового платежа в самообслуживании. Высокорисковые эквайеры
 * ограничивают разовую операцию у новых продавцов и помечают всё крупное
 * на проверку, поэтому пакеты дороже обсуждаются отдельно и вручную.
 */
export const SELF_SERVICE_PAYMENT_CAP_USD = 600;

/** Пороги счётчика в звонке, в долларах израсходованного. */
export const SPEND_WARN_USD = 50;   // предупреждаем
export const SPEND_CONFIRM_USD = 100; // требуем подтверждения продолжения

/** За сколько минут до нуля предупреждаем, что жетоны заканчиваются. */
export const LOW_BALANCE_WARN_MINUTES = 2;

export function tokensToUsd(tokens) {
  return tokens / TOKENS_PER_USD;
}

export function usdToTokens(usd) {
  return Math.round(usd * TOKENS_PER_USD);
}

/** Ставка за минуту для режима с учётом того, действуют ли стартовые цены. */
export function ratePerMinute(modeId, { launchPricing = true } = {}) {
  const mode = CALL_MODES[modeId];
  if (!mode) throw new Error(`Неизвестный режим звонка: ${modeId}`);
  return launchPricing ? mode.launch : mode.standard;
}

/** Сколько минут выйдет из баланса в этом режиме (вниз до целой минуты). */
export function affordableMinutes(balanceTokens, modeId, opts) {
  return Math.floor(balanceTokens / ratePerMinute(modeId, opts));
}

export function getPlan(planId) {
  const plan = PLANS[planId];
  if (!plan) throw new Error(`Неизвестный тариф: ${planId}`);
  return plan;
}

export function getPack(packId) {
  const pack = TOKEN_PACKS.find((p) => p.id === packId);
  if (!pack) throw new Error(`Неизвестный пакет: ${packId}`);
  return pack;
}
