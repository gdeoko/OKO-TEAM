// Тарифная сетка — единый источник правды для всех лимитов.
// Цены/скидки см. docs/OKO_APP_CONTEXT.txt §3. -1 = без лимита.

export type Tier = 'free' | 'start' | 'pro' | 'business' | 'scale';

export const TIER_ORDER: Tier[] = ['free', 'start', 'pro', 'business', 'scale'];

export interface TierLimits {
  fileMaxBytes: number;            // лимит размера файла в чатах
  videoChecksPerMonth: number;     // мини-апп «Видео-премодератор»
  autopostNetworks: number;        // сколько соцсетей в автопостинге
  contentVideosPerMonth: number;   // контент-завод
  systemAccess: boolean;           // Система роста по анкете
  callRecording: boolean;
  partnerProgram: boolean;         // активация партнёрки
}

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    fileMaxBytes: 100 * MB,
    videoChecksPerMonth: 1,
    autopostNetworks: 0,
    contentVideosPerMonth: 0,
    systemAccess: false,
    callRecording: false,
    partnerProgram: false,
  },
  start: {
    fileMaxBytes: 2 * GB,
    videoChecksPerMonth: 10,
    autopostNetworks: 0,
    contentVideosPerMonth: 0,
    systemAccess: false,
    callRecording: true,
    partnerProgram: true,
  },
  pro: {
    fileMaxBytes: 2 * GB,
    videoChecksPerMonth: 30,
    autopostNetworks: 3,
    contentVideosPerMonth: 0,
    systemAccess: true,
    callRecording: true,
    partnerProgram: true,
  },
  business: {
    fileMaxBytes: -1,
    videoChecksPerMonth: -1,
    autopostNetworks: -1,
    contentVideosPerMonth: 30,
    systemAccess: true,
    callRecording: true,
    partnerProgram: true,
  },
  scale: {
    fileMaxBytes: -1,
    videoChecksPerMonth: -1,
    autopostNetworks: -1,
    contentVideosPerMonth: -1,   // по договору
    systemAccess: true,
    callRecording: true,
    partnerProgram: true,
  },
};

export const tierAtLeast = (tier: Tier, min: Tier): boolean =>
  TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(min);

// Партнёрка: 2 уровня, ступень 15% -> 5% после 6 мес подписки клиента.
export const PARTNER_L1_PERCENT = 15;
export const PARTNER_L1_PERCENT_AFTER_6M = 5;
export const PARTNER_L2_PERCENT = 5;
