// Проверки денежной части. Здесь ошибка стоит реальных денег и споров с
// банком, поэтому каждое правило из ценовой модели закрыто тестом.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWallet, balance, grantSubscriptionTokens, purchaseTokens, spend, expireGrant, compensate, InsufficientTokens } from '../src/wallet.js';
import { CallSession, CallState, EndReason } from '../src/call.js';
import { ratePerMinute, affordableMinutes, TOKEN_PACKS, PLANS, SELF_SERVICE_PAYMENT_CAP_USD, tokensToUsd } from '../src/tariffs.js';

test('ставки режимов соотносятся как 1 : 2 : 4', () => {
  assert.equal(ratePerMinute('regular'), 100);
  assert.equal(ratePerMinute('hot'), 200);
  assert.equal(ratePerMinute('adult'), 400);
  assert.equal(ratePerMinute('regular', { launchPricing: false }), 150);
  assert.equal(ratePerMinute('adult', { launchPricing: false }), 600);
});

test('баланс тарифа даёт заявленные минуты на витрине', () => {
  // 1 500 - это 15 минут разговора или 4 минуты 18+ (вниз до целой минуты)
  assert.equal(affordableMinutes(1500, 'regular'), 15);
  assert.equal(affordableMinutes(1500, 'adult'), 3);
  assert.equal(affordableMinutes(3000, 'regular'), 30);
  assert.equal(affordableMinutes(3000, 'adult'), 7);
  assert.equal(affordableMinutes(5000, 'regular'), 50);
  assert.equal(affordableMinutes(5000, 'adult'), 12);
});

test('VIP возвращает жетонами всю свою цену', () => {
  assert.equal(tokensToUsd(PLANS.vip.grant), PLANS.vip.priceUsd);
});

test('ни один пакет в самообслуживании не превышает потолок эквайера', () => {
  for (const pack of TOKEN_PACKS) {
    assert.ok(pack.priceUsd <= SELF_SERVICE_PAYMENT_CAP_USD,
      `пакет ${pack.id} стоит ${pack.priceUsd}, а потолок ${SELF_SERVICE_PAYMENT_CAP_USD}`);
  }
});

test('скидка растёт с размером пакета и не опускается ниже 6$ за тысячу', () => {
  let prev = Infinity;
  for (const pack of TOKEN_PACKS) {
    const per1000 = pack.priceUsd / (pack.tokens / 1000);
    assert.ok(per1000 <= prev, `пакет ${pack.id} дороже предыдущего за тысячу`);
    assert.ok(per1000 >= 6, `пакет ${pack.id} дешевле пола в 6$ за тысячу`);
    prev = per1000;
  }
});

test('подаренные жетоны сгорают, купленные остаются', () => {
  const w = createWallet();
  grantSubscriptionTokens(w, 'basic');
  purchaseTokens(w, 'p3');
  assert.equal(balance(w), 1500 + 3000);

  expireGrant(w);
  assert.equal(w.granted, 0);
  assert.equal(w.purchased, 3000, 'купленные жетоны сгорать не имеют права');
});

test('новое начисление не накапливает прошлое подаренное', () => {
  const w = createWallet();
  grantSubscriptionTokens(w, 'vip');   // 5000
  grantSubscriptionTokens(w, 'vip');   // месяц закрыт, прошлое сгорело
  assert.equal(w.granted, 5000, 'подаренное не должно складываться из месяца в месяц');
});

test('тратим сначала подаренное, потом купленное', () => {
  const w = createWallet();
  grantSubscriptionTokens(w, 'basic'); // 1500 granted
  purchaseTokens(w, 'p1');             // 1000 purchased

  const r = spend(w, 2000, { kind: 'call' });
  assert.deepEqual(r, { fromGranted: 1500, fromPurchased: 500 });
  assert.equal(w.granted, 0);
  assert.equal(w.purchased, 500);
});

test('списать больше, чем есть, нельзя', () => {
  const w = createWallet();
  purchaseTokens(w, 'p1');
  assert.throws(() => spend(w, 1001), InsufficientTokens);
  assert.equal(balance(w), 1000, 'неудачное списание не меняет баланс');
});

test('компенсация кладётся в несгораемый карман', () => {
  const w = createWallet();
  grantSubscriptionTokens(w, 'basic');
  compensate(w, 400, 'видео встало на третьей минуте');
  expireGrant(w);
  assert.equal(balance(w), 400, 'компенсация не должна сгореть вместе с подаренным');
});

// --- звонок ---

function walletWith(tokens) {
  const w = createWallet();
  w.purchased = tokens;
  return w;
}

test('первая минута списывается на старте, в долг звонок не идёт', () => {
  const w = walletWith(1000);
  const call = new CallSession({ wallet: w, mode: 'adult' }); // 400/мин
  assert.equal(call.state, CallState.ACTIVE);
  assert.equal(call.minutesBilled, 1);
  assert.equal(balance(w), 600);
});

test('звонок не начинается, если не хватает даже на первую минуту', () => {
  const w = walletWith(399);
  const call = new CallSession({ wallet: w, mode: 'adult' });
  assert.equal(call.state, CallState.ENDED);
  assert.equal(call.endReason, EndReason.OUT_OF_TOKENS);
  assert.equal(balance(w), 399, 'с пустого звонка деньги не списываются');
});

test('на исходе баланса героиня прощается, а не обрывает связь', () => {
  const w = walletWith(800); // ровно две минуты 18+
  const call = new CallSession({ wallet: w, mode: 'adult' });
  call.tick(); // вторая минута
  assert.equal(balance(w), 0);
  call.tick(); // на третью денег нет
  assert.equal(call.state, CallState.ENDING);
  assert.equal(call.endReason, EndReason.OUT_OF_TOKENS);
  assert.ok(call.events.some((e) => e.type === 'farewell'), 'должно быть прощание');
  call.finish();
  assert.equal(call.state, CallState.ENDED);
});

test('предупреждаем, когда до нуля осталось две минуты', () => {
  const w = walletWith(1600); // 4 минуты 18+
  const call = new CallSession({ wallet: w, mode: 'adult' });
  assert.ok(!call.events.some((e) => e.type === 'low_balance'));
  call.tick(); // осталось 2 минуты
  assert.ok(call.events.some((e) => e.type === 'low_balance'), 'должно быть предупреждение');
});

test('на 50$ предупреждение, на 100$ остановка до подтверждения', () => {
  const w = walletWith(200000);
  const call = new CallSession({ wallet: w, mode: 'adult' }); // 400 жет = 4$/мин
  for (let i = 0; i < 12; i += 1) call.tick(); // 13 минут = 52$
  assert.ok(call.events.some((e) => e.type === 'spend_warning'));
  assert.equal(call.state, CallState.ACTIVE, 'на 50$ только предупреждаем');

  while (call.state === CallState.ACTIVE) call.tick();
  assert.equal(call.state, CallState.AWAITING_CONFIRMATION);
  assert.ok(call.spentUsd >= 100);
});

test('пока ждём подтверждения, время не тарифицируется', () => {
  const w = walletWith(200000);
  const call = new CallSession({ wallet: w, mode: 'adult' });
  while (call.state === CallState.ACTIVE) call.tick();
  const frozen = call.tokensSpent;
  call.tick(); call.tick();
  assert.equal(call.tokensSpent, frozen, 'ожидание подтверждения должно быть бесплатным');
});

test('подтверждение продолжает звонок, отказ завершает его мягко', () => {
  const w = walletWith(200000);
  const call = new CallSession({ wallet: w, mode: 'adult' });
  while (call.state === CallState.ACTIVE) call.tick();
  call.confirmContinue();
  assert.equal(call.state, CallState.ACTIVE);
  call.tick();
  assert.equal(call.state, CallState.ACTIVE, 'до следующей сотни не переспрашиваем');

  const w2 = walletWith(200000);
  const call2 = new CallSession({ wallet: w2, mode: 'adult' });
  while (call2.state === CallState.ACTIVE) call2.tick();
  call2.declineContinue();
  assert.equal(call2.endReason, EndReason.DECLINED_CONFIRMATION);
  assert.ok(call2.events.some((e) => e.type === 'farewell'));
});

test('подтверждение спрашивается на каждой следующей сотне', () => {
  const w = walletWith(200000);
  const call = new CallSession({ wallet: w, mode: 'adult' });
  while (call.state === CallState.ACTIVE) call.tick();
  assert.ok(call.spentUsd >= 100 && call.spentUsd < 200);
  call.confirmContinue();
  while (call.state === CallState.ACTIVE) call.tick();
  assert.ok(call.spentUsd >= 200, 'на второй сотне должны спросить снова');
});

test('смена режима требует показанной новой ставки', () => {
  const w = walletWith(10000);
  const call = new CallSession({ wallet: w, mode: 'regular' });
  assert.throws(() => call.changeMode('adult'), /подтверждения новой ставки/);
  assert.throws(() => call.changeMode('adult', { acknowledgedRate: 100 }), /подтверждения новой ставки/);

  call.changeMode('adult', { acknowledgedRate: 400 });
  assert.equal(call.rate, 400);
  call.tick();
  assert.equal(call.tokensSpent, 100 + 400, 'после смены считаем по новой ставке');
});

test('сбой по нашей вине помечает сессию к компенсации жетонами', () => {
  const w = walletWith(10000);
  const call = new CallSession({ wallet: w, mode: 'hot' });
  call.tick();
  call.failure('видео встало');
  const ev = call.events.find((e) => e.type === 'failure');
  assert.equal(ev.refundableTokens, 400, 'возвращаем ровно то, что списали');
  assert.equal(call.endReason, EndReason.FAILURE);

  compensate(w, ev.refundableTokens, 'сбой сервиса');
  assert.equal(balance(w), 10000, 'человек не должен остаться в минусе из-за нашего сбоя');
});
