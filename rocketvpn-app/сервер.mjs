/* Маленький сервер файлов для стендов.

   Страницу нельзя открывать как file://: браузер считает такой адрес
   «источником null» и не отдаёт картинки в WebGL - текстура воды, неба и
   планеты не загружается, а сцена падает с ошибкой CORS. Настоящий
   адрес http://127.0.0.1 снимает это целиком, как на боевом сервере. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ТИПЫ = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".svg": "image/svg+xml", ".wav": "audio/wav", ".mp3": "audio/mpeg",
  ".woff2": "font/woff2", ".json": "application/json", ".glb": "model/gltf-binary"
};

export function поднятьСервер(корень) {
  return new Promise((да) => {
    const с = createServer(async (зап, отв) => {
      try {
        const путь = decodeURIComponent(new URL(зап.url, "http://x").pathname);
        let файл = normalize(join(корень, путь));
        if (!файл.startsWith(корень)) { отв.writeHead(403); отв.end(); return; }
        if (путь.endsWith("/")) файл = join(файл, "index.html");
        const тело = await readFile(файл);
        отв.writeHead(200, { "Content-Type": ТИПЫ[extname(файл).toLowerCase()] || "application/octet-stream",
                             "Cache-Control": "no-store" });
        отв.end(тело);
      } catch (о) {
        отв.writeHead(404); отв.end("нет");
      }
    });
    с.listen(0, "127.0.0.1", () => да({ адрес: "http://127.0.0.1:" + с.address().port, закрыть: () => с.close() }));
  });
}
