// TG Mini App адаптер: инициализация @telegram-apps/sdk, проброс initData
// в /auth/telegram, тема (чёрный + лайм), раскрытие на весь экран.
import { init, miniApp, viewport, initData } from '@telegram-apps/sdk';

export async function bootTgMiniApp() {
  init();
  if (miniApp.mount.isAvailable()) miniApp.mount();
  if (viewport.mount.isAvailable()) {
    await viewport.mount();
    viewport.expand();
  }
  miniApp.setHeaderColor('#000000');
  miniApp.setBackgroundColor('#000000');

  const raw = initData.raw();
  if (!raw) throw new Error('Не в контексте Telegram Mini App');

  const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/telegram`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      initData: raw,
      refCode: new URLSearchParams(location.search).get('ref') ?? undefined,
    }),
  });
  if (!res.ok) throw new Error('Авторизация не прошла');
  return res.json();
}
