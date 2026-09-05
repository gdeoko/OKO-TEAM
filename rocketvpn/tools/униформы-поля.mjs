import { chromium } from "playwright";
const бр = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const с = await бр.newPage({ viewport: { width: 1440, height: 900 } });
await с.goto("http://127.0.0.1:8170/", { waitUntil: "domcontentloaded", timeout: 90000 });
await с.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](), null, { timeout: 300000 }).catch(()=>{});
await с.waitForTimeout(3000);
for (const доля of [0.35, 0.45, 0.6]) {
  await с.evaluate((д) => window.RV_MOTION["кПунктy"]("прокол", д), доля);
  await с.waitForTimeout(3000);
  console.log(доля, JSON.stringify(await с.evaluate(() => {
    const у = window.RV_ТРУБА["узел"]();
    const из = [];
    у.traverse((о) => {
      if (!/^поле кольца /.test(о.name || "")) return;
      const un = о.material && о.material.uniforms ? о.material.uniforms : {};
      const п = о.getWorldPosition(new (о.matrixWorld.constructor === Object ? Object : window.THREE ? window.THREE.Vector3 : Object)());
      из.push({
        имя: о.name, видно: о.visible,
        uAlpha: un.uAlpha ? +un.uAlpha.value.toFixed(3) : null,
        uVhod: un.uVhod ? +un.uVhod.value.toFixed(3) : null,
        uScaleD: un.uScaleD ? +un.uScaleD.value.toFixed(3) : null,
        uRingY: un.uRingY ? +un.uRingY.value.toFixed(2) : null,
        масштаб: +о.scale.x.toFixed(2),
        режим: о.material ? о.material.blending : null
      });
    });
    return из;
  })));
}
await бр.close();
