// Кошелёк. Два разных кармана жетонов с разными правилами.
//
//   granted   - начислены подпиской, СГОРАЮТ в конце оплаченного месяца
//   purchased - куплены пакетом, НЕ СГОРАЮТ НИКОГДА
//
// Тратим сначала granted: они всё равно сгорят, и человек не должен терять
// купленное, пока лежит нетронутое подаренное.

import { getPlan, getPack } from './tariffs.js';

export class InsufficientTokens extends Error {
  constructor(need, have) {
    super(`Недостаточно жетонов: нужно ${need}, на балансе ${have}`);
    this.name = 'InsufficientTokens';
    this.need = need;
    this.have = have;
  }
}

export function createWallet() {
  return { granted: 0, purchased: 0, grantExpiresAt: null, ledger: [] };
}

export function balance(wallet) {
  return wallet.granted + wallet.purchased;
}

function record(wallet, entry) {
  wallet.ledger.push({ at: entry.at ?? new Date().toISOString(), ...entry });
}

/**
 * Начисление жетонов подписки. Прежний неизрасходованный остаток granted
 * НЕ накапливается: месяц закрыт - подаренное за него сгорело.
 */
export function grantSubscriptionTokens(wallet, planId, { at = new Date(), expiresAt } = {}) {
  const plan = getPlan(planId);
  const burned = wallet.granted;
  wallet.granted = plan.grant;
  wallet.grantExpiresAt = (expiresAt ?? addMonth(at)).toISOString?.() ?? expiresAt;
  record(wallet, {
    at: at.toISOString(), type: 'grant', planId,
    tokens: plan.grant, burnedPrevious: burned,
  });
  return wallet;
}

/** Покупка пакета. Эти жетоны живут вечно. */
export function purchaseTokens(wallet, packId, { at = new Date() } = {}) {
  const pack = getPack(packId);
  wallet.purchased += pack.tokens;
  record(wallet, { at: at.toISOString(), type: 'purchase', packId, tokens: pack.tokens, priceUsd: pack.priceUsd });
  return wallet;
}

/** Сгорание подаренных жетонов по окончании оплаченного месяца. */
export function expireGrant(wallet, { at = new Date() } = {}) {
  const burned = wallet.granted;
  if (burned === 0) return 0;
  wallet.granted = 0;
  wallet.grantExpiresAt = null;
  record(wallet, { at: at.toISOString(), type: 'expire', tokens: -burned });
  return burned;
}

/**
 * Списание. Сначала granted, потом purchased.
 * Возвращает, сколько ушло из каждого кармана.
 */
export function spend(wallet, tokens, meta = {}) {
  if (tokens < 0) throw new Error('Списание не может быть отрицательным');
  if (tokens === 0) return { fromGranted: 0, fromPurchased: 0 };
  const have = balance(wallet);
  if (tokens > have) throw new InsufficientTokens(tokens, have);

  const fromGranted = Math.min(wallet.granted, tokens);
  const fromPurchased = tokens - fromGranted;
  wallet.granted -= fromGranted;
  wallet.purchased -= fromPurchased;
  record(wallet, { type: 'spend', tokens: -tokens, fromGranted, fromPurchased, ...meta });
  return { fromGranted, fromPurchased };
}

/**
 * Компенсация за сбой по нашей вине. Возвращаем ЖЕТОНЫ на баланс, а не деньги
 * на карту: деньги на карту - это движение средств клиенту, оно требует
 * отдельного решения владельца и вдобавок читается эквайером как возврат.
 * Компенсация кладётся в purchased - человек её не терял, пусть не сгорает.
 */
export function compensate(wallet, tokens, reason, { at = new Date() } = {}) {
  if (tokens <= 0) throw new Error('Компенсация должна быть положительной');
  wallet.purchased += tokens;
  record(wallet, { at: at.toISOString(), type: 'compensation', tokens, reason });
  return wallet;
}

function addMonth(date) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + 1);
  return d;
}
