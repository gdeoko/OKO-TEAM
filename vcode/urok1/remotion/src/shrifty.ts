import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Шрифты подключаются руками: файлы лежат в public/font, но css никто не
 * подключал, и весь ролик шёл системным гротеском. Пока семейства реально не
 * загрузились, рендер ждёт, иначе первые кадры уедут на подменном шрифте.
 */
export const СЕМЬИ = [
  "Unbounded", "Inter", "Montserrat", "Oswald", "Russo One",
  "Rubik", "Playfair Display", "Yeseva One", "Manrope",
];

const метка = delayRender("шрифты урока");

if (typeof document !== "undefined") {
  for (const путь of ["font/fonts.css", "font/fonts2.css"]) {
    const л = document.createElement("link");
    л.rel = "stylesheet";
    л.href = staticFile(путь);
    document.head.appendChild(л);
  }
  const проба = СЕМЬИ.flatMap((с) => [
    (document as any).fonts.load(`900 120px "${с}"`),
    (document as any).fonts.load(`400 120px "${с}"`),
  ]);
  Promise.all(проба)
    .then(() => (document as any).fonts.ready)
    .then(() => continueRender(метка))
    .catch(() => continueRender(метка));
} else {
  continueRender(метка);
}
