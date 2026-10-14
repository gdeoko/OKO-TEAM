import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

const корень = "/home/user/OKO-TEAM/vcode/urok1/remotion";
const куда = process.argv[3] || "/tmp/claude-0/-home-user/87110edc-cde6-5d7c-bdc5-c8d944591fd1/scratchpad/kadry";
fs.mkdirSync(куда, { recursive: true });
const кадры = process.argv[2].split(",").map(Number);

const url = await bundle({ entryPoint: path.join(корень, "src/index.ts"), publicDir: path.join(корень, "public") });
const comp = await selectComposition({ serveUrl: url, id: "Urok6", inputProps: {} });
for (const f of кадры) {
  await renderStill({
    composition: comp, serveUrl: url, frame: f,
    output: path.join(куда, `f${String(f).padStart(5, "0")}.png`),
    inputProps: {}, imageFormat: "png", chromiumOptions: { gl: "angle" },
  });
  console.log("кадр", f);
}
