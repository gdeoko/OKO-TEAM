import * as THREE from 'three';

// ============================================================
// СТАНЦИЯ «ПОКЕР» — процедурный стол + 4 карты-формата турниров.
// Единая сцена/кино: камера поворачивается вправо к тёмному углу клуба, на столе лежат
// 4 карты (Bounty Sniper / Joker / Ladies Night / Strange). Карты иногда сами приподнимаются
// и переворачиваются; клик поднимает карту к зрителю (физика «лист» — добавится в инкременте B).
// БЕЗ зелёного сукна (казино-вид запрещён): тёмный фетр + красный кант DUCK'S.
// API: group (THREE.Group), update(t, dt, pk, pointer), setReveal(pk), cards[].
// ============================================================

const FORMATS = [
  { key: 'bounty', name: 'BOUNTY SNIPER', suit: '♠', accent: '#E50000', sub: 'выбиваешь игрока, забираешь его очки' },
  { key: 'joker',  name: 'JOKER',         suit: '🃏', accent: '#8B00FF', sub: 'особые механики меняют ход игры' },
  { key: 'ladies', name: 'LADIES NIGHT',  suit: '♥', accent: '#FF1744', sub: 'вечер, где правят девушки' },
  { key: 'strange',name: 'STRANGE',       suit: '★', accent: '#FFD600', sub: 'нестандартные правила' },
];

// --- текстуры (canvas) ---------------------------------------------------
function roundRect(x, ctx, X, Y, W, H, R) { ctx.beginPath(); ctx.moveTo(X + R, Y); ctx.arcTo(X + W, Y, X + W, Y + H, R); ctx.arcTo(X + W, Y + H, X, Y + H, R); ctx.arcTo(X, Y + H, X, Y, R); ctx.arcTo(X, Y, X + W, Y, R); ctx.closePath(); }

function cardFaceTexture(fmt) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 716;
  const x = c.getContext('2d');
  // фон карты — глубокий чёрный с лёгким виньетом
  x.fillStyle = '#0a0a0c'; x.fillRect(0, 0, 512, 716);
  const vg = x.createRadialGradient(256, 358, 60, 256, 358, 420);
  vg.addColorStop(0, 'rgba(255,255,255,0.05)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  x.fillStyle = vg; x.fillRect(0, 0, 512, 716);
  // рамка акцентного цвета формата
  x.strokeStyle = fmt.accent; x.lineWidth = 10; x.shadowColor = fmt.accent; x.shadowBlur = 28;
  roundRect(0, x, 26, 26, 460, 664, 34); x.stroke();
  x.shadowBlur = 0;
  // крупный символ масти по центру
  x.fillStyle = fmt.accent; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = fmt.accent; x.shadowBlur = 40;
  x.font = '260px Georgia, serif';
  x.fillText(fmt.suit, 256, 320);
  x.shadowBlur = 0;
  // угловые символы
  x.font = 'bold 64px Georgia, serif';
  x.textAlign = 'left';  x.fillText(fmt.suit, 56, 92);
  x.textAlign = 'right'; x.save(); x.translate(456, 624); x.rotate(Math.PI); x.fillText(fmt.suit, 0, 0); x.restore();
  // название формата
  x.fillStyle = '#ffffff'; x.textAlign = 'center'; x.font = '900 44px Orbitron, sans-serif';
  x.shadowColor = 'rgba(0,0,0,0.8)'; x.shadowBlur = 8;
  x.fillText(fmt.name.split(' ')[0], 256, 470);
  if (fmt.name.split(' ')[1]) x.fillText(fmt.name.split(' ')[1], 256, 522);
  x.shadowBlur = 0;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

let _backTex = null;
function cardBackTexture() {
  if (_backTex) return _backTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 716;
  const x = c.getContext('2d');
  x.fillStyle = '#9e0008'; x.fillRect(0, 0, 512, 716);                      // фирменный красный
  const g = x.createLinearGradient(0, 0, 512, 716);
  g.addColorStop(0, '#cc0000'); g.addColorStop(0.5, '#7a0006'); g.addColorStop(1, '#cc0000');
  x.fillStyle = g; x.fillRect(0, 0, 512, 716);
  // ромбовидный паттерн
  x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 2;
  for (let i = -10; i < 20; i++) { x.beginPath(); x.moveTo(i * 48, 0); x.lineTo(i * 48 + 716, 716); x.stroke(); x.beginPath(); x.moveTo(i * 48, 716); x.lineTo(i * 48 + 716, 0); x.stroke(); }
  // белая рамка-овал + DUCK'S
  x.fillStyle = 'rgba(8,8,8,0.55)'; x.strokeStyle = '#fff'; x.lineWidth = 6;
  roundRect(0, x, 70, 150, 372, 416, 30); x.fill(); x.stroke();
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '900 70px Orbitron, sans-serif'; x.fillText("DUCK'S", 256, 358);
  _backTex = new THREE.CanvasTexture(c); _backTex.colorSpace = THREE.SRGBColorSpace; _backTex.anisotropy = 8;
  return _backTex;
}

function feltTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  // тёмный фетр (НЕ зелёный — казино-вид запрещён): угольно-чёрный с лёгким красным тоном
  x.fillStyle = '#100a0c'; x.fillRect(0, 0, 512, 512);
  const g = x.createRadialGradient(256, 256, 40, 256, 256, 300);
  g.addColorStop(0, '#1c1214'); g.addColorStop(1, '#0a0608');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  // зерно фетра
  const img = x.getImageData(0, 0, 512, 512), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// --- одна карта ----------------------------------------------------------
const CARD_W = 0.62, CARD_H = 0.87, CARD_T = 0.016;
function buildCard(fmt) {
  const geo = new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H);   // лежит плашмя (толщина по Y)
  const edge = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
  const faceMat = new THREE.MeshStandardMaterial({ map: cardFaceTexture(fmt), roughness: 0.45, metalness: 0.0, emissive: new THREE.Color(fmt.accent), emissiveIntensity: 0.0 });
  const backMat = new THREE.MeshStandardMaterial({ map: cardBackTexture(), roughness: 0.5, metalness: 0.0 });
  // BoxGeometry группы: 0 +x,1 -x,2 +y(верх),3 -y(низ),4 +z,5 -z
  // лицо смотрит ВНИЗ когда лежит рубашкой вверх → верх (+y)=рубашка, низ(-y)=лицо
  const face = faceMat.clone();
  const mats = [edge, edge, backMat, face, edge, edge];
  const card = new THREE.Mesh(geo, mats);
  card.castShadow = true;
  card.userData = { fmt, faceMat: face, baseY: 0, flip: 0, flipTarget: 0, nextFlip: 2 + Math.random() * 5, lift: 0 };
  return card;
}

export class PokerStation {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
    this._reveal = 0;

    // тёплое пятно света над столом
    this.spot = new THREE.SpotLight(0xffd9b0, 0, 14, Math.PI / 5, 0.5, 1.2);
    this.spot.position.set(0, 6, 1.5);
    this.spot.target.position.set(0, 0, 0.4);
    this.group.add(this.spot, this.spot.target);
    this.fill = new THREE.PointLight(0xcc2222, 0, 10); this.fill.position.set(-2, 1.5, 3); this.group.add(this.fill);

    // СТОЛ: тёмный фетр (диск) + красный кант
    const felt = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.6, 0.18, 64),
      new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 0.92, metalness: 0.0 })
    );
    felt.receiveShadow = true; felt.position.y = -0.09; this.group.add(felt);
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.16, 16, 80),
      new THREE.MeshStandardMaterial({ color: 0x2a0a0c, roughness: 0.35, metalness: 0.3, emissive: 0x330000, emissiveIntensity: 0.5 })
    );
    rail.rotation.x = Math.PI / 2; rail.position.y = 0.02; this.group.add(rail);

    // 4 карты дугой к зрителю
    this.cards = [];
    const spread = 1.45;
    FORMATS.forEach((fmt, i) => {
      const card = buildCard(fmt);
      const fx = (i - 1.5) * (spread / 1.5) * 0.62;
      card.position.set(fx, 0.02, 0.5);
      card.rotation.y = (i - 1.5) * 0.06;                 // лёгкий веер
      card.userData.baseY = 0.02;
      card.userData.home = card.position.clone();
      card.userData.homeRotY = card.rotation.y;
      this.group.add(card);
      this.cards.push(card);
    });
  }

  // pk 0..1 — насколько станция «проявлена» (по скроллу)
  setReveal(pk) {
    this._reveal = pk;
    this.group.visible = pk > 0.001;
    const e = THREE.MathUtils.clamp((pk - 0.15) / 0.5, 0, 1);
    this.spot.intensity = 26 * e;
    this.fill.intensity = 8 * e;
    this.group.traverse((o) => {
      if (o.isMesh && o.material) {
        const mm = Array.isArray(o.material) ? o.material : [o.material];
        mm.forEach((m) => { if (m.transparent === false) { m.transparent = true; } m.opacity = e; });
      }
    });
  }

  update(t, dt) {
    if (!this.group.visible) return;
    // авто-переворот: иногда случайная карта приподнимается, показывает лицо, ложится обратно
    this.cards.forEach((card) => {
      const u = card.userData;
      u.nextFlip -= dt;
      if (u.nextFlip <= 0 && Math.abs(u.flipTarget - u.flip) < 0.01) {
        u.flipTarget = u.flipTarget > 1 ? 0 : Math.PI;   // показать лицо / вернуть рубашку
        u.nextFlip = 4 + Math.random() * 7;
      }
      u.flip += (u.flipTarget - u.flip) * Math.min(1, dt * 4);
      // подъём во время переворота (карта чуть взлетает над столом)
      const lift = Math.sin(THREE.MathUtils.clamp(u.flip / Math.PI, 0, 1) * Math.PI) * 0.22;
      card.position.y = u.baseY + lift;
      card.rotation.x = u.flip;                            // переворот вокруг длинной оси
      // подсветка лица при показе
      u.faceMat.emissiveIntensity = (u.flip > 1.2 ? 0.35 : 0.0);
    });
  }
}
