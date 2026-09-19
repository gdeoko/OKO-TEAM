// Счётчик звонка.
//
// Правила, от которых зависят деньги и споры с банком:
//   1. Режим выбирается ДО старта, ставка фиксируется на старте.
//   2. Сменить режим может только человек явным действием. Героиня - никогда.
//   3. Счётчик виден всегда. На 50$ предупреждаем, на 100$ останавливаемся и
//      требуем подтверждения продолжить.
//   4. За две минуты до нуля предупреждаем. На нуле героиня прощается и
//      завершает сессию - обрыва связи не бывает.
//
// Тарификация поминутная, по начатой минуте. Первая минута списывается на
// старте, поэтому звонок никогда не идёт в долг.

import {
  ratePerMinute, tokensToUsd, CALL_MODES,
  SPEND_WARN_USD, SPEND_CONFIRM_USD, LOW_BALANCE_WARN_MINUTES,
} from './tariffs.js';
import { spend, balance, InsufficientTokens } from './wallet.js';

export const CallState = {
  ACTIVE: 'active',
  AWAITING_CONFIRMATION: 'awaiting_confirmation',
  ENDING: 'ending',
  ENDED: 'ended',
};

export const EndReason = {
  USER: 'user_hung_up',
  OUT_OF_TOKENS: 'out_of_tokens',
  DECLINED_CONFIRMATION: 'declined_confirmation',
  FAILURE: 'service_failure',
};

export class CallSession {
  /**
   * @param {object} opts
   * @param {object} opts.wallet кошелёк пользователя
   * @param {string} opts.mode  режим из CALL_MODES
   * @param {boolean} [opts.launchPricing=true] действуют ли стартовые цены
   */
  constructor({ wallet, mode, launchPricing = true, heroine = null, startedAt = new Date() }) {
    if (!CALL_MODES[mode]) throw new Error(`Неизвестный режим звонка: ${mode}`);
    this.wallet = wallet;
    this.launchPricing = launchPricing;
    this.heroine = heroine;
    this.startedAt = startedAt;
    this.mode = mode;
    this.rate = ratePerMinute(mode, { launchPricing });
    this.minutesBilled = 0;
    this.tokensSpent = 0;
    this.state = CallState.ACTIVE;
    this.endReason = null;
    this.events = [];
    this.confirmedAtUsd = 0; // до какой суммы человек уже подтвердил продолжение

    // Не начинаем звонок, за который нечем заплатить даже первую минуту.
    if (balance(wallet) < this.rate) {
      this.state = CallState.ENDED;
      this.endReason = EndReason.OUT_OF_TOKENS;
      this.#emit('rejected', { need: this.rate, have: balance(wallet) });
      return;
    }
    this.#billOneMinute();
    this.#emit('started', { mode, rate: this.rate });
    this.#checkThresholds();
  }

  get spentUsd() { return tokensToUsd(this.tokensSpent); }

  /** Сколько ещё минут выйдет в текущем режиме при нынешнем балансе. */
  get minutesRemaining() { return Math.floor(balance(this.wallet) / this.rate); }

  get isBillable() { return this.state === CallState.ACTIVE; }

  /**
   * Прошла ещё одна минута разговора. Вызывается таймером сессии.
   * Пока сессия ждёт подтверждения, время не тарифицируется.
   */
  tick() {
    if (this.state === CallState.AWAITING_CONFIRMATION) return this.snapshot();
    if (this.state !== CallState.ACTIVE) return this.snapshot();

    try {
      this.#billOneMinute();
    } catch (err) {
      if (err instanceof InsufficientTokens) {
        this.#beginGracefulEnd(EndReason.OUT_OF_TOKENS);
        return this.snapshot();
      }
      throw err;
    }
    this.#checkThresholds();
    return this.snapshot();
  }

  /**
   * Смена режима по ходу звонка. Только явным действием человека и только
   * с показанной новой ставкой - на этом держится защита от оспаривания.
   */
  changeMode(nextMode, { acknowledgedRate } = {}) {
    if (this.state !== CallState.ACTIVE) {
      throw new Error('Сменить режим можно только в активном звонке');
    }
    if (!CALL_MODES[nextMode]) throw new Error(`Неизвестный режим звонка: ${nextMode}`);
    const newRate = ratePerMinute(nextMode, { launchPricing: this.launchPricing });
    if (acknowledgedRate !== newRate) {
      throw new Error(
        `Смена режима требует подтверждения новой ставки: показать ${newRate} жет./мин и передать её обратно`,
      );
    }
    if (balance(this.wallet) < newRate) {
      throw new InsufficientTokens(newRate, balance(this.wallet));
    }
    const from = this.mode;
    this.mode = nextMode;
    this.rate = newRate;
    this.#emit('mode_changed', { from, to: nextMode, rate: newRate });
    return this.snapshot();
  }

  /** Человек нажал «продолжаем» на пороге в 100$. */
  confirmContinue() {
    if (this.state !== CallState.AWAITING_CONFIRMATION) return this.snapshot();
    this.confirmedAtUsd = Math.max(this.confirmedAtUsd, this.#nextConfirmThreshold());
    this.state = CallState.ACTIVE;
    this.#emit('spend_confirmed', { atUsd: this.spentUsd, confirmedUpToUsd: this.confirmedAtUsd });
    return this.snapshot();
  }

  /** Человек отказался продолжать на пороге. Завершаем мягко. */
  declineContinue() {
    if (this.state !== CallState.AWAITING_CONFIRMATION) return this.snapshot();
    this.#beginGracefulEnd(EndReason.DECLINED_CONFIRMATION);
    return this.snapshot();
  }

  /** Человек положил трубку. */
  hangUp() {
    if (this.state === CallState.ENDED) return this.snapshot();
    this.#beginGracefulEnd(EndReason.USER);
    return this.finish();
  }

  /**
   * Сбой по нашей вине. Героиня поплыла, видео встало. Завершаем и помечаем
   * сессию к компенсации жетонами - решение о размере принимает обработчик,
   * деньги на карту не трогаем никогда.
   */
  failure(reason = 'service_failure') {
    this.#beginGracefulEnd(EndReason.FAILURE);
    this.#emit('failure', { reason, refundableTokens: this.tokensSpent });
    return this.finish();
  }

  /** Прощание отыграно, сессия закрывается. */
  finish() {
    if (this.state === CallState.ENDED) return this.snapshot();
    this.state = CallState.ENDED;
    this.#emit('ended', { reason: this.endReason, minutes: this.minutesBilled, tokens: this.tokensSpent });
    return this.snapshot();
  }

  snapshot() {
    return {
      state: this.state,
      mode: this.mode,
      rate: this.rate,
      minutesBilled: this.minutesBilled,
      tokensSpent: this.tokensSpent,
      spentUsd: Number(this.spentUsd.toFixed(2)),
      balance: balance(this.wallet),
      minutesRemaining: this.minutesRemaining,
      endReason: this.endReason,
      events: this.events,
    };
  }

  // --- внутреннее ---

  #billOneMinute() {
    spend(this.wallet, this.rate, { kind: 'call', mode: this.mode });
    this.minutesBilled += 1;
    this.tokensSpent += this.rate;
  }

  #nextConfirmThreshold() {
    // Пороги идут каждые SPEND_CONFIRM_USD: 100, 200, 300...
    return Math.floor(this.spentUsd / SPEND_CONFIRM_USD) * SPEND_CONFIRM_USD;
  }

  #checkThresholds() {
    if (this.spentUsd >= SPEND_WARN_USD && !this.#hasEvent('spend_warning')) {
      this.#emit('spend_warning', { atUsd: this.spentUsd });
    }
    const threshold = this.#nextConfirmThreshold();
    if (threshold > 0 && threshold > this.confirmedAtUsd) {
      this.state = CallState.AWAITING_CONFIRMATION;
      this.#emit('confirmation_required', { atUsd: this.spentUsd, thresholdUsd: threshold });
      return;
    }
    if (this.minutesRemaining <= LOW_BALANCE_WARN_MINUTES && !this.#hasEvent('low_balance')) {
      this.#emit('low_balance', { minutesRemaining: this.minutesRemaining });
    }
  }

  #beginGracefulEnd(reason) {
    if (this.state === CallState.ENDED) return;
    this.state = CallState.ENDING;
    this.endReason = reason;
    // Героиня прощается. Обрыва связи в интимный момент не бывает - это злость
    // и заявление в банк. Прощание не тарифицируется.
    this.#emit('farewell', { reason });
  }

  #hasEvent(type) { return this.events.some((e) => e.type === type); }

  #emit(type, data = {}) {
    this.events.push({ type, at: new Date().toISOString(), ...data });
  }
}
