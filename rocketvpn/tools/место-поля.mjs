import { chromium } from "playwright";
const бр = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1234/chrome-linux64/chrome",
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
const с = await бр.newPage({ viewport: { width: 1440, height: 900 } });
await с.goto("http://127.0.0.1:8170/", { waitUntil: "domcontentloaded", timeout: 90000 });
await с.waitForFunction(() => window.RV_WORLD && window.RV_WORLD["вступлениеИдёт"] && !window.RV_WORLD["вступлениеИдёт"](), null, { timeout: 300000 }).catch(()=>{});
await с.waitForTimeout(3000);
await с.evaluate(() => window.RV_MOTION["кПунктy"]("прокол", 0.45));
await с.waitForTimeout(4000);

console.log(JSON.stringify(await с.evaluate(() => {
  const W = window.RV_WORLD["мир"](), T = W.T, кам = W.cam;
  кам.updateMatrixWorld(true);
  const у = window.RV_ТРУБА["узел"]();
  const из = [];
  const в = new T.Vector3();
  у.traverse((о) => {
    if (!/^поле кольца /.test(о.name || "")) return;
    о.getWorldPosition(в);
    const мир = в.clone();
    // глубина по видовой оси, как её считает шейдер
    const вид = мир.clone().applyMatrix4(кам.matrixWorldInverse);
    // нормаль диска в мире
    const н = new T.Vector3(0, 0, 1).applyQuaternion(о.getWorldQuaternion(new T.Quaternion()));
    const кКам = кам.position.clone().sub(мир).normalize();
    // экранный размер
    const п1 = мир.clone().project(кам);
    const кр = мир.clone().add(new T.Vector3(о.scale.x * 0.5, 0, 0)).project(кам);
    из.push({
      имя: о.name, видно: о.visible,
      мир: [+мир.x.toFixed(2), +мир.y.toFixed(2), +мир.z.toFixed(2)],
      глубинаВида: +(-вид.z).toFixed(2),
      делённая: +(-вид.z / (о.material.uniforms.uScaleD ? о.material.uniforms.uScaleD.value : 1)).toFixed(2),
      нормальНаКамеру: +н.dot(кКам).toFixed(3),
      ndc: [+п1.x.toFixed(2), +п1.y.toFixed(2), +п1.z.toFixed(3)],
      полуширинаNDC: +Math.abs(кр.x - п1.x).toFixed(3)
    });
  });
  return из;
}), null, 1));
await бр.close();
