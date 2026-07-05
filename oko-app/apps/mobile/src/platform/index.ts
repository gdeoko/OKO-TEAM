// Платформенный адаптер: одно ядро — разные витрины (§2 контекста).
// TG Mini App отличается: пуши через бота, звонки во внешнем браузере, нет фона.

export type OkoPlatform = 'native' | 'web' | 'tg-miniapp';

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string; openLink: (url: string) => void } };
  }
}

export function detectPlatform(): OkoPlatform {
  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') return 'native';
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) return 'tg-miniapp';
  return 'web';
}

export const platformCaps = (p: OkoPlatform) => ({
  push: p !== 'tg-miniapp',          // в TG пуши шлёт бот-уведомитель
  inAppCalls: p !== 'tg-miniapp',    // в TG звонок открывается во внешнем браузере
  background: p === 'native',
});
