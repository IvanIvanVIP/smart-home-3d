import * as THREE from 'three';

/* Вид «за окном»: дневное небо, облака, солнце, двор с деревьями и соседние дома.
   Всё процедурное — внешних файлов не нужно. Квартира в начале координат, окна смотрят на север (−z). */

const GROUND_Y = -12;          // земля на 12 м ниже пола квартиры (примерно 4-й этаж)
const SKY_RADIUS = 150;        // купол неба; дальняя плоскость камеры — 200
const FOG_COLOR = 0xe3eef6;    // цвет дымки у горизонта (совпадает с низом неба)

/* Небольшой детерминированный генератор случайных чисел — пейзаж каждый раз одинаковый */
function makeRandom(seed) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skyTexture() {
  return canvasTexture(4, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);   // верх холста = зенит
    grad.addColorStop(0.00, '#4a8fdc');
    grad.addColorStop(0.30, '#79b2ea');
    grad.addColorStop(0.46, '#c9e1f4');
    grad.addColorStop(0.50, '#e3eef6');                // горизонт
    grad.addColorStop(0.56, '#e3eef6');
    grad.addColorStop(1.00, '#cfdbe2');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

function glowTexture(inner, outer) {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

/* Фасад дома: 4 окна по горизонтали и 8 этажей на один «модуль» текстуры (≈ 12 × 24 м) */
function facadeTexture(rand) {
  const tex = canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#f4f1ea';
    g.fillRect(0, 0, w, h);
    const cw = w / 4, ch = h / 8;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 4; c++) {
        const k = rand();
        g.fillStyle = k < 0.12 ? '#f3dfa6' : k < 0.45 ? '#b4cbe0' : '#8aa5be';   // свет / блик / тёмное стекло
        g.fillRect(c * cw + cw * 0.2, r * ch + ch * 0.2, cw * 0.6, ch * 0.55);
        g.fillStyle = 'rgba(0,0,0,0.10)';                                          // подоконник
        g.fillRect(c * cw + cw * 0.16, r * ch + ch * 0.77, cw * 0.68, ch * 0.06);
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function buildingGeometry(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  // грани BoxGeometry по 4 вершины: +x, −x, +y, −y, +z, −z; ширина стены → число «модулей» окон
  const faceWidth = [d, d, 0, 0, w, w];
  for (let face = 0; face < 6; face++) {
    if (!faceWidth[face]) continue;
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, uv.getX(i) * (faceWidth[face] / 12), uv.getY(i) * (h / 24));
    }
  }
  return geo;
}

export function createOutdoors(scene) {
  const rand = makeRandom(20261018);
  const root = new THREE.Group();
  root.name = 'Outdoors';
  scene.add(root);

  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.Fog(FOG_COLOR, 70, 175);

  // Небо: купол, который едет вместе с камерой, рисуется первым и не пишет в буфер глубины
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 32, 16),
    new THREE.MeshBasicMaterial({
      map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false, depthTest: false, toneMapped: false,
    }),
  );
  dome.renderOrder = -1000;
  dome.frustumCulled = false;
  root.add(dome);

  // Солнце и облака
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,248,225,1)', 'rgba(255,236,190,0)'),
    blending: THREE.AdditiveBlending, fog: false, depthWrite: false, toneMapped: false,
  }));
  sun.scale.set(70, 70, 1);
  sun.position.set(55, 60, -105);
  root.add(sun);

  const cloudTex = glowTexture('rgba(255,255,255,0.95)', 'rgba(255,255,255,0)');
  for (let i = 0; i < 16; i++) {
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.55 + rand() * 0.35, fog: false, depthWrite: false, toneMapped: false,
    }));
    const a = rand() * Math.PI * 2;                 // по кругу, чаще над севером (куда смотрят окна)
    const north = Math.PI * 1.5 + (rand() - 0.5) * 2.6;
    const ang = rand() < 0.7 ? north : a;
    const dist = 105 + rand() * 25;
    cloud.position.set(Math.cos(ang) * dist, 18 + rand() * 55, Math.sin(ang) * dist);
    const s = 45 + rand() * 50;
    cloud.scale.set(s * 1.9, s * 0.6, 1);
    root.add(cloud);
  }

  // Земля: двор и дорога
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(175, 48),
    new THREE.MeshBasicMaterial({ color: 0x9dbd88, toneMapped: false }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = GROUND_Y;
  root.add(ground);

  const road = new THREE.Mesh(
    new THREE.RingGeometry(31, 37, 64),
    new THREE.MeshBasicMaterial({ color: 0x7d838b, toneMapped: false }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.y = GROUND_Y + 0.05;
  root.add(road);

  // Соседние дома по кругу (угол 0 — север, куда смотрят окна), фасадами к квартире
  const facade = facadeTexture(rand);
  const tints = [0xffffff, 0xf6e6d2, 0xe7eef5, 0xf0e0e0, 0xe9f0e2, 0xf3ecd8];
  const count = 30;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.12;
    const dist = (i % 3 === 0 ? 46 : 62) + rand() * 38;
    const w = 18 + rand() * 18, d = 12 + rand() * 8, h = 24 + rand() * 30;
    const tint = tints[Math.floor(rand() * tints.length)];
    const side = new THREE.MeshBasicMaterial({ map: facade, color: tint, toneMapped: false });
    const roof = new THREE.MeshBasicMaterial({ color: 0xb9bec4, toneMapped: false });
    const building = new THREE.Mesh(buildingGeometry(w, h, d), [side, side, roof, roof, side, side]);
    building.position.set(Math.sin(a) * dist, GROUND_Y + h / 2, -Math.cos(a) * dist);
    building.rotation.y = -a;                       // грань +z смотрит на центр
    root.add(building);
  }

  // Деревья во дворе
  const trees = 110;
  const crowns = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    trees,
  );
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.18, 0.25, 1, 6),
    new THREE.MeshLambertMaterial({ color: 0x7a5c44 }),
    trees,
  );
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const color = new THREE.Color();
  for (let i = 0; i < trees; i++) {
    const a = rand() * Math.PI * 2;
    const r = i < 70 ? 7 + rand() * 20 : 38 + rand() * 25;   // двор и полоса за дорогой
    const trunkH = 2 + rand() * 2.5, crownR = 1.8 + rand() * 1.8;
    const x = Math.sin(a) * r, z = -Math.cos(a) * r;
    pos.set(x, GROUND_Y + trunkH / 2, z);
    trunks.setMatrixAt(i, m.compose(pos, q, scl.set(1, trunkH, 1)));
    pos.set(x, GROUND_Y + trunkH + crownR * 0.7, z);
    crowns.setMatrixAt(i, m.compose(pos, q, scl.set(crownR, crownR * 0.9, crownR)));
    crowns.setColorAt(i, color.setHSL(0.24 + rand() * 0.08, 0.38 + rand() * 0.2, 0.36 + rand() * 0.14));
  }
  root.add(crowns, trunks);

  return {
    root,   // всё, что снаружи: нужно, например, чтобы скрыть его при расчёте затенения в углах
    /* купол неба всегда вокруг камеры, чтобы горизонт не «уезжал» */
    update(camera) {
      dome.position.copy(camera.position);
    },
  };
}
