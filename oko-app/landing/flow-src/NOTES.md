# /flow — WebGPU curl-lines (Omma → OKO)

Источник: пользовательский zip "varywebgpucurllines" (создано в Omma, three r183 WebGPU + TSL compute + bloom).
Правки под OKO: фон #060706, палитра 'OKO' (лайм), дев-панель/FPS скрыты, камера привязана к скроллу
(влёт radius 21→7 + параллакс от курсора/гироскопа), OKO-копирайт поверх.

Сборка: `npm i && npx vite build` (vite.config target esnext — из-за top-level await).
Деплой: dist/* → сайт true-journey-418 в app/public/flow/. Живёт: /flow/ (index.html 307→/flow/).
ВНИМАНИЕ: WebGPU. В headless-Chromium (swiftshader) device-lost — визуально там не проверить.
Нужен Chrome/Edge/Android Chrome/Safari iOS18+.
