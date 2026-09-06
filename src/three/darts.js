import * as THREE from 'three';

// ============================================================
// СТАНЦИЯ «ДАРТС» — процедурная мишень в пустоте + мини-игра броска.
// Мишень рисуется на canvas (20 секторов, кольца дабл/трипл, булл/яблочко, проволока,
// бренд-неон #CC0000). Медленно вращается. Дротик — из примитивов (без GLB).
// Мини-игра: ТАП по мишени → дротик летит дугой из-за камеры → втыкается → очки по зоне.
// 3 дротика в серии, потом суммарный счёт; следующий тап — новая серия.
// Easter egg «tipsy» (0..1): прицел/полёт слегка «плывёт» (связь с баром).
// API: group, setReveal(dk), update(t,dt,camera), tap(raycaster,camera), aim(raycaster), reset().
// hooks: { onHit(points,label,total,left), onThrow(), onMiss() } — звук/HUD из main.
// ============================================================

// Порядок секторов мишени по часовой стрелке от верхней (20).
const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
// Радиусы колец как доля игрового радиуса (по стандарту дартса, упрощённо).
const R_BULLSEYE = 0.037, R_BULL = 0.094;
const R_TRIP_IN = 0.49, R_TRIP_OUT = 0.55;
const R_DOUB_IN = 0.94, R_DOUB_OUT = 1.0;

const COL_BLACK = '#0c0c0e', COL_CREAM = '#e7d7a0';
const COL_RED = '#d11a1a', COL_GREEN = '#1c8a4e';
const COL_BULL = '#1c8a4e', COL_BULLSEYE = '#d11a1a';
const COL_WIRE = 'rgba(196,176,120,0.55)';

const BR = 1.6;                 // игровой радиус мишени в мировых единицах

// точка экрана→полярные координаты сектора (математический угол, +X=0, против часовой)
function numberAtAngle(deg) {
  let k = Math.round((90 - deg) / 18) % 20;           // верх=90°, по часовой = индекс растёт
  if (k < 0) k += 20;
  return SECTORS[k];
}

// нарисовать заливку кольцевого сектора (от a0 до a1 град, радиусы r0..r1 в долях R) в canvas
function wedge(x, cx, cy, R, r0, r1, a0, a1, fill) {
  const step = (a1 - a0) / 10;
  x.beginPath();
  for (let a = a0, first = true; a <= a1 + 0.001; a += step) {
    const rad = a * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    const px = cx + R * r1 * c, py = cy - R * r1 * s;
    if (first) { x.moveTo(px, py); first = false; } else x.lineTo(px, py);
  }
  for (let a = a1; a >= a0 - 0.001; a -= step) {
    const rad = a * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
    x.lineTo(cx + R * r0 * c, cy - R * r0 * s);
  }
  x.closePath(); x.fillStyle = fill; x.fill();
}

function boardTexture() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const cx = S / 2, cy = S / 2, R = S * 0.46;
  // тёмный фон-обод (вне игровой зоны) + неон-кольцо
  x.fillStyle = '#070708'; x.beginPath(); x.arc(cx, cy, S * 0.5, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(cx, cy, R * R_DOUB_OUT + 6, 0, Math.PI * 2);
  x.strokeStyle = 'rgba(204,0,0,0.9)'; x.lineWidth = 10; x.shadowColor = '#cc0000'; x.shadowBlur = 26; x.stroke();
  x.shadowBlur = 0;
  // 20 секторов
  for (let i = 0; i < 20; i++) {
    const center = 90 - i * 18, a0 = center - 9, a1 = center + 9;
    const num = SECTORS[i];
    const dark = (i % 2 === 0);                       // чередование чёрный/кремовый
    const single = dark ? COL_BLACK : COL_CREAM;
    const ring = dark ? COL_RED : COL_GREEN;          // дабл/трипл: на чёрном красный, на кремовом зелёный
    wedge(x, cx, cy, R, R_BULL, R_TRIP_IN, a0, a1, single);          // внутреннее одиночное
    wedge(x, cx, cy, R, R_TRIP_IN, R_TRIP_OUT, a0, a1, ring);        // трипл
    wedge(x, cx, cy, R, R_TRIP_OUT, R_DOUB_IN, a0, a1, single);      // внешнее одиночное
    wedge(x, cx, cy, R, R_DOUB_IN, R_DOUB_OUT, a0, a1, ring);        // дабл
    // номер сектора снаружи
    const rad = center * Math.PI / 180;
    const nx = cx + R * 1.085 * Math.cos(rad), ny = cy - R * 1.085 * Math.sin(rad);
    x.fillStyle = '#f4ecd0'; x.font = '700 38px Orbitron, "Exo 2", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(num), nx, ny);
  }
  // булл и яблочко
  x.beginPath(); x.arc(cx, cy, R * R_BULL, 0, Math.PI * 2); x.fillStyle = COL_BULL; x.fill();
  x.beginPath(); x.arc(cx, cy, R * R_BULLSEYE, 0, Math.PI * 2); x.fillStyle = COL_BULLSEYE; x.fill();
  // проволока: радиальные спицы + кольцевые границы
  x.strokeStyle = COL_WIRE; x.lineWidth = 2;
  for (let i = 0; i < 20; i++) {
    const a = (99 - i * 18) * Math.PI / 180;
    x.beginPath(); x.moveTo(cx + R * R_BULL * Math.cos(a), cy - R * R_BULL * Math.sin(a));
    x.lineTo(cx + R * R_DOUB_OUT * Math.cos(a), cy - R * R_DOUB_OUT * Math.sin(a)); x.stroke();
  }
  [R_BULL, R_TRIP_IN, R_TRIP_OUT, R_DOUB_IN, R_DOUB_OUT].forEach((r) => {
    x.beginPath(); x.arc(cx, cy, R * r, 0, Math.PI * 2); x.stroke();
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// Материалы дротика одинаковы для всех бросков — держим их ОБЩИМИ (один раз),
// иначе каждый бросок плодил 3 новых материала, а reset() их не освобождал (утечка).
const DART_STEEL = new THREE.MeshStandardMaterial({ color: 0xcdd2d8, roughness: 0.3, metalness: 0.85 });
const DART_DARK = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.5, metalness: 0.4 });
const DART_FLIGHT = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.5, metalness: 0.0,
  emissive: 0x550000, emissiveIntensity: 0.6, side: THREE.DoubleSide });

// процедурный дротик: остриё + ствол + хвостовик + оперение. Длинная ось = локальная +Z (остриё в +Z).
function buildDart() {
  const g = new THREE.Group();
  const steel = DART_STEEL;
  const dark = DART_DARK;
  const flightMat = DART_FLIGHT;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.10, 12), steel);
  tip.rotation.x = -Math.PI / 2; tip.position.z = 0.30; g.add(tip);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.22, 14), steel);
  barrel.rotation.x = Math.PI / 2; barrel.position.z = 0.14; g.add(barrel);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.14, 8), dark);
  shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.04; g.add(shaft);
  // оперение — два перекрещенных пера
  for (let i = 0; i < 2; i++) {
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.10), flightMat);
    fin.rotation.z = i * Math.PI / 2; fin.position.z = -0.12; g.add(fin);
  }
  g.scale.setScalar(1.5);
  return g;
}

export class DartsStation {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.group = new THREE.Group();
    this.group.visible = false;

    // мишень (в подгруппе, чтобы вращалась, а прицел/HUD — нет)
    this.boardGroup = new THREE.Group();
    this.group.add(this.boardGroup);
    const disc = new THREE.CircleGeometry(BR * 1.04, 64);
    this.board = new THREE.Mesh(disc, new THREE.MeshStandardMaterial({
      map: boardTexture(), roughness: 0.85, metalness: 0.0, transparent: true, opacity: 0,
    }));
    this.boardGroup.add(this.board);
    // неоновый обод (тор)
    this.rim = new THREE.Mesh(
      new THREE.TorusGeometry(BR * 1.02, 0.05, 14, 80),
      new THREE.MeshStandardMaterial({ color: 0x1a0608, roughness: 0.35, metalness: 0.4,
        emissive: 0xcc0000, emissiveIntensity: 0.9, transparent: true, opacity: 0 })
    );
    this.boardGroup.add(this.rim);

    // свет на мишень
    this.spot = new THREE.SpotLight(0xfff0e0, 0, 22, Math.PI / 5, 0.6, 1.0);
    this.spot.position.set(0, 1.4, 4.5); this.spot.target.position.set(0, 0, 0);
    this.group.add(this.spot, this.spot.target);
    this.fill = new THREE.PointLight(0xcc2222, 0, 14); this.fill.position.set(-1.5, 0.5, 3.5);
    this.group.add(this.fill);

    // «пустотная» атмосфера — редкие дрейфующие искры
    const N = 260, pos = new Float32Array(N * 3), spd = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = -2 - Math.random() * 10;
      spd[i] = 0.1 + Math.random() * 0.3;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._dustSpd = spd;
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({
      color: 0x9fb4cc, size: 0.03, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.group.add(this.dust);

    // прицел — тонкое кольцо на плоскости мишени
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.10, 0.13, 28),
      new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0, depthTest: false })
    );
    this.reticle.renderOrder = 5;
    this.group.add(this.reticle);
    this._aim = new THREE.Vector3(0, 0, 0.02);

    this.darts = [];            // воткнутые дротики
    this.flying = null;         // { mesh, t, dur, p0, p1, peak, spin }
    this.dartsLeft = 3;
    this.seriesTotal = 0;
    this.tipsy = 0;             // 0..1, ставит main (связь с баром)
    this._rev = 0;
    this._tphase = Math.random() * 10;
  }

  // dk — прогресс станции 0..1
  setReveal(dk) {
    this._rev = dk;
    this.group.visible = dk > 0.02;
    if (!this.group.visible) return;
    const e = THREE.MathUtils.clamp((dk - 0.1) / 0.5, 0, 1);
    const es = e * e * (3 - 2 * e);
    this.group.scale.setScalar(0.55 + 0.45 * es);
    this.spot.intensity = 34 * es;
    this.fill.intensity = 10 * es;
    this.board.material.opacity = es;
    this.rim.material.opacity = es;
    this.dust.material.opacity = 0.5 * es;
    this.darts.forEach((d) => d.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = es; } }));
  }

  // мировой луч → точка на плоскости мишени (локально boardGroup); вернуть {local, score, label} или null
  _hit(raycaster) {
    const h = raycaster.intersectObject(this.board, false);
    if (!h.length) return null;
    const local = this.boardGroup.worldToLocal(h[0].point.clone());
    const d = Math.hypot(local.x, local.y) / BR;
    let score = 0, label = 'мимо';
    if (d <= 1.0) {
      const deg = Math.atan2(local.y, local.x) * 180 / Math.PI;
      const num = numberAtAngle(deg);
      if (d <= R_BULLSEYE) { score = 50; label = 'ЯБЛОЧКО!'; }
      else if (d <= R_BULL) { score = 25; label = 'БУЛЛ'; }
      else if (d >= R_TRIP_IN && d <= R_TRIP_OUT) { score = num * 3; label = 'ТРИПЛ ' + num; }
      else if (d >= R_DOUB_IN && d <= R_DOUB_OUT) { score = num * 2; label = 'ДАБЛ ' + num; }
      else { score = num; label = String(num); }
    }
    return { local, score, label };
  }

  // навести прицел (без броска) — для hover на ПК
  aim(raycaster) {
    if (this.flying) return;
    const h = raycaster.intersectObject(this.board, false);
    if (h.length) this._aim.copy(this.boardGroup.worldToLocal(h[0].point.clone()));
  }

  // ТАП = бросок в точку. camera нужна для старта полёта (дротик летит «из-за камеры»)
  tap(raycaster, camera) {
    if (this.flying) return null;
    // новая серия после исчерпания
    if (this.dartsLeft <= 0) { this.reset(); }
    const hit = this._hit(raycaster);
    if (!hit) return null;
    this._aim.copy(hit.local);
    // старт полёта: позиция камеры в координатах group, чуть ниже линии взгляда
    const start = this.group.worldToLocal(camera.getWorldPosition(_v).clone());
    start.y -= 0.3;
    // конечная точка — на плоскости мишени, в координатах group (через boardGroup→group)
    const endWorld = this.boardGroup.localToWorld(hit.local.clone());
    const end = this.group.worldToLocal(endWorld.clone());
    const dart = buildDart();
    this.group.add(dart);
    this.flying = { mesh: dart, t: 0, dur: 0.42, p0: start.clone(), p1: end.clone(),
      peak: 0.5 + Math.random() * 0.3, spin: (Math.random() - 0.5) * 0.4, hit };
    this.dartsLeft--;
    if (this.hooks.onThrow) this.hooks.onThrow();
    return hit;
  }

  reset() {
    this.darts.forEach((d) => { this.boardGroup.remove(d); d.traverse((o) => { o.geometry && o.geometry.dispose && o.geometry.dispose(); }); });
    this.darts.length = 0;
    this.dartsLeft = 3; this.seriesTotal = 0;
  }

  _land(f) {
    const dart = f.mesh;
    // зафиксировать дротик на мишени (учитываем вращение боард-группы через attach)
    this.boardGroup.attach(dart);
    // заметный наклон воткнутого дротика (виден ствол/оперение, не «торчит головой в камеру»)
    dart.rotation.x += 0.32 + (Math.random() - 0.5) * 0.25;
    dart.rotation.y += (Math.random() - 0.5) * 0.4;
    this.darts.push(dart);
    if (this.darts.length > 9) { const old = this.darts.shift(); this.boardGroup.remove(old); }
    const s = f.hit.score;
    this.seriesTotal += s;
    if (s > 0 && this.hooks.onHit) this.hooks.onHit(s, f.hit.label, this.seriesTotal, this.dartsLeft);
    else if (s === 0 && this.hooks.onMiss) this.hooks.onMiss();
  }

  update(t, dt, camera) {
    if (!this.group.visible) return;
    // медленное вращение мишени
    this.boardGroup.rotation.z = Math.sin(t * 0.08) * 0.06 + t * 0.015;
    // дрейф искр к камере
    const arr = this.dust.geometry.attributes.position.array;
    for (let i = 0; i < this._dustSpd.length; i++) {
      arr[i * 3 + 2] += this._dustSpd[i] * dt;
      if (arr[i * 3 + 2] > 6) { arr[i * 3 + 2] = -12; arr[i * 3] = (Math.random() - 0.5) * 16; arr[i * 3 + 1] = (Math.random() - 0.5) * 10; }
    }
    this.dust.geometry.attributes.position.needsUpdate = true;

    // прицел: к точке прицеливания + «опьянение» (плывёт по кругу), на плоскости мишени
    const drift = this.tipsy * 0.32;
    const dx = Math.sin(t * 1.7 + this._tphase) * drift, dy = Math.cos(t * 1.3 + this._tphase) * drift;
    _v.set(this._aim.x + dx, this._aim.y + dy, 0.03);
    this.boardGroup.localToWorld(_v); this.group.worldToLocal(_v);
    this.reticle.position.lerp(_v, Math.min(1, dt * 10));
    this.reticle.lookAt(this.boardGroup.getWorldPosition(_w).add(this.boardGroup.getWorldDirection(_n).multiplyScalar(-1)));
    const showRet = this._rev > 0.55 && !this.flying;
    this.reticle.material.opacity += ((showRet ? 0.85 : 0) - this.reticle.material.opacity) * Math.min(1, dt * 8);

    // полёт дротика — дуга p0→p1 + доворот острия по направлению
    if (this.flying) {
      const f = this.flying; f.t += dt / f.dur; const k = Math.min(1, f.t);
      const ek = k * k * (3 - 2 * k);
      _v.lerpVectors(f.p0, f.p1, ek);
      _v.y += Math.sin(ek * Math.PI) * f.peak;        // подброс по дуге
      f.mesh.position.copy(_v);
      // ориентируем дротик по касательной к траектории (смотрит вперёд +Z по движению)
      _n.subVectors(f.p1, f.p0).normalize();
      f.mesh.lookAt(_v.clone().add(_n));
      f.mesh.rotation.z += f.spin * (1 - k);
      if (k >= 1) { this.flying = null; this._land(f); }
    }
  }
}

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _n = new THREE.Vector3();
