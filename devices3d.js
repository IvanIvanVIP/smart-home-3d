import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* 3D-модели умных устройств из простых форм. Размеры — реальные, в метрах.
   Начало координат каждой модели — центр её основания (низ лежит на y = 0),
   «лицо» устройства смотрит в +z. Билдер возвращает { group, setOn(on) }:
   group ставится в сцену, setOn вызывается при переключении устройства в карточке.
   Текстуры экранов вырезаны с фотографий товаров (папка textures/). */

const textureLoader = new THREE.TextureLoader();
function loadTexture(url, srgb = true) {
  const t = textureLoader.load(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* Скруглённая коробка: radius даёт фаски/скругления на всех рёбрах, а не острый параллелепипед. */
function rbox(w, h, d, r, material, segments = 3) {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, segments, r), material);
}


/* Контур скруглённого прямоугольника (для плоских корпусов с большим радиусом в плане) */
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);         s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r);     s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h);         s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r);             s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
}
/* Плоская пластина w × h × d с радиусом углов r в плане и фаской bevel по краю; центр в начале, толщина вдоль z */
function plate(w, h, d, r, bevel, material) {
  const depth = d - 2 * bevel;
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - 2 * bevel, h - 2 * bevel, Math.max(r - bevel, 0.0005)), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10,
  });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, material);
}
/* Тело вращения по профилю [[радиус, высота], …]; ось — y */
function lathe(points, material, segments = 40) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments), material);
  m.material.side = THREE.DoubleSide;
  return m;
}
const std = (color, roughness = 0.5, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
/* ---------- Станция Миди ---------- */

/* Тканевая обивка: мелкое плетение (цвет снят с фото, ≈#dca02a после освещения) — для цвета и для рельефа (bumpMap) */
function fabricTexture() {
  const size = 128, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#c47a0a';
  g.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const odd = ((x + y) / 2) % 2 === 0;
      g.fillStyle = odd ? 'rgba(255,190,70,0.30)' : 'rgba(90,40,0,0.28)';
      g.fillRect(x, y, 2, 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 8);
  t.anisotropy = 4;
  return t;
}

/* Верхняя панель: тёмное стекло с кнопками «−» и «+» и точками-датчиками вокруг кнопки Алисы (как на фото) */
function midiTopTexture() {
  const size = 256, c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#2b2c33');
  grad.addColorStop(1, '#16171c');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#9a9ba6';
  g.fillRect(size * 0.27, size * 0.5 - 1.5, 14, 3);                                   // «−»
  g.fillRect(size * 0.73 - 7, size * 0.5 - 1.5, 14, 3);                               // «+»
  g.fillRect(size * 0.73 - 1.5, size * 0.5 - 7, 3, 14);
  g.fillStyle = '#5f606b';
  for (const [x, y] of [[0.5, 0.3], [0.5, 0.7], [0.36, 0.5], [0.64, 0.5], [0.34, 0.34], [0.66, 0.34]]) {
    g.beginPath(); g.arc(size * x, size * y, 2, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildMidi() {
  const group = new THREE.Group();
  group.name = 'Device_Midi';

  const fabric = fabricTexture();
  const fabricMat = new THREE.MeshStandardMaterial({ map: fabric, bumpMap: fabric, bumpScale: 0.6, roughness: 0.95, metalness: 0 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x18181d, roughness: 0.55, metalness: 0.1 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1c1d23, roughness: 0.22, metalness: 0.2 });
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x4a1fd0, emissive: 0x7a3dff, emissiveIntensity: 1.1, roughness: 0.4, metalness: 0,
  });

  // Снизу вверх: тёмное основание 5 мм → тканевый корпус 99 мм → светящийся шов 3 мм → верхняя панель 13 мм = 120 мм
  const base = rbox(0.116, 0.005, 0.116, 0.0025, darkMat, 2);
  base.position.y = 0.0025;
  const body = rbox(0.12, 0.099, 0.12, 0.012, fabricMat, 4);
  body.position.y = 0.005 + 0.0495;
  const ring = rbox(0.1205, 0.003, 0.1205, 0.0015, ringMat, 3);
  ring.position.y = 0.104 + 0.0015;
  const top = rbox(0.12, 0.013, 0.12, 0.0055, glassMat, 4);
  top.position.y = 0.107 + 0.0065;

  // Накладка с кнопками на верхней грани
  const topFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.108, 0.108),
    new THREE.MeshStandardMaterial({ map: midiTopTexture(), roughness: 0.3, metalness: 0.15 }),
  );
  topFace.rotation.x = -Math.PI / 2;
  topFace.position.y = 0.1202;

  // Кнопка Алисы: светящееся кольцо в центре верхней панели
  const aliceMat = new THREE.MeshStandardMaterial({ color: 0xb98cff, emissive: 0xd2b0ff, emissiveIntensity: 1.8, roughness: 0.3 });
  const alice = new THREE.Mesh(new THREE.TorusGeometry(0.0072, 0.0012, 8, 28), aliceMat);
  alice.rotation.x = Math.PI / 2;
  alice.position.y = 0.1207;

  // Часы на передней грани — текстура вырезана с фото (белые «точечные» цифры 12:35 на прозрачном фоне)
  const clockMat = new THREE.MeshBasicMaterial({
    map: loadTexture('textures/midi_clock.png'), transparent: true, toneMapped: false, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2,
  });
  const clock = new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.052 * 209 / 417), clockMat);
  clock.position.set(0, 0.058, 0.0603);

  // Задняя грань: кнопка отключения микрофона и порт USB-C (как на втором фото)
  const mic = rbox(0.021, 0.0075, 0.003, 0.0025, darkMat, 2);
  mic.position.set(0, 0.073, -0.0603);
  const usb = rbox(0.0115, 0.0045, 0.003, 0.002, darkMat, 2);
  usb.position.set(0, 0.03, -0.0603);

  group.add(base, body, ring, top, topFace, alice, clock, mic, usb);

  return {
    group,
    /* on = Алиса слушает: кольцо и кнопка горят ярче */
    setOn(on) {
      ringMat.emissiveIntensity = on ? 3.2 : 1.4;
      aliceMat.emissiveIntensity = on ? 3.6 : 1.8;
    },
  };
}



/* ---------- Общее для остальных устройств ---------- */

/* Светодиод: маленькая светящаяся точка; setLed(on) меняет цвет и яркость */
function makeLed(radius, offColor, onColor, offI = 0, onI = 2.5) {
  const mat = new THREE.MeshStandardMaterial({ color: offColor, emissive: offColor, emissiveIntensity: offI, roughness: 0.4 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), mat);
  return {
    mesh,
    set(on) { const c = on ? onColor : offColor; mat.color.setHex(c); mat.emissive.setHex(c); mat.emissiveIntensity = on ? onI : offI; },
  };
}

/* Логотип «Я» для корпусов выключателей */
function logoTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0)';
  g.clearRect(0, 0, 64, 64);
  g.fillStyle = '#c9cbd0';
  g.beginPath(); g.arc(32, 32, 28, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#f4f5f6';
  g.font = 'bold 38px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('Я', 32, 35);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- Умная розетка ----------
   Начало — центр задней стороны розеточной пластины на стене; лицо смотрит в +z. */
export function buildOutlet() {
  const group = new THREE.Group();
  group.name = 'Device_Outlet';
  const white = std(0xf1f1ef, 0.5), dark = std(0x26272b, 0.6), metal = std(0xb9bdc4, 0.35, 0.9);

  const wall = plate(0.082, 0.082, 0.010, 0.012, 0.0025, white);          // стенная розетка
  wall.position.z = 0.005;
  const plug = rbox(0.055, 0.074, 0.040, 0.011, white, 4);                 // сама умная розетка (вилка)
  plug.position.z = 0.010 + 0.020;
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.0195, 0.0195, 0.002, 28), dark);   // гнездо на лицевой стороне
  socket.rotation.x = Math.PI / 2;
  socket.position.set(0, 0.009, 0.0505);
  const holes = [-0.0085, 0.0085].map((x) => {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.0012, 14), std(0x050505, 0.8));
    h.rotation.x = Math.PI / 2; h.position.set(x, 0.009, 0.0516); return h;
  });
  const clips = [-1, 1].map((s) => {                                       // заземляющие контакты сверху и снизу
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.0025, 0.0012), metal);
    c.position.set(0, 0.009 + s * 0.0171, 0.0516); return c;
  });
  const button = rbox(0.005, 0.022, 0.003, 0.002, std(0xdfe0e2, 0.4), 2);   // вертикальная кнопка с индикатором
  button.position.set(-0.0165, -0.0205, 0.0505);
  const led = makeLed(0.0014, 0x6a7078, 0x39ff7a, 0.0, 3.0);
  led.mesh.position.set(-0.0165, -0.0282, 0.0522);

  group.add(wall, plug, socket, ...holes, ...clips, button, led.mesh);
  return { group, setOn: (on) => led.set(on) };
}

/* ---------- Умный хаб Яндекса ----------
   Низкий диск: белое основание, тёмный ребристый поясок, чёрная крышка. Начало — центр низа; сверху +y. */
export function buildHub() {
  const group = new THREE.Group();
  group.name = 'Device_Hub';
  const baseMat = std(0xf4f4f3, 0.42);
  const base = lathe([[0, 0], [0.033, 0], [0.040, 0.003], [0.0432, 0.009], [0.0438, 0.016], [0.0432, 0.019], [0, 0.019]], baseMat);

  const c = document.createElement('canvas');                              // поясок с вентиляционными прорезями
  c.width = 256; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4a4e'; g.fillRect(0, 0, 256, 32);
  g.fillStyle = '#18181b';
  for (let x = 0; x < 256; x += 16) g.fillRect(x, 0, 6, 32);
  const slats = new THREE.CanvasTexture(c);
  slats.colorSpace = THREE.SRGBColorSpace;
  slats.wrapS = THREE.RepeatWrapping;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0436, 0.0436, 0.0085, 48, 1, true), std(0xffffff, 0.6, 0, { map: slats }));
  ring.position.y = 0.019 + 0.00425;
  const ringTop = new THREE.Mesh(new THREE.CircleGeometry(0.0436, 40), std(0x2a2a2e, 0.6));
  ringTop.rotation.x = -Math.PI / 2; ringTop.position.y = 0.0275;

  const lid = lathe([[0, 0.0275], [0.0455, 0.0275], [0.0468, 0.0288], [0.0468, 0.0322], [0.0452, 0.0338], [0, 0.0338]], std(0x0d0d10, 0.18, 0.25), 48);
  group.add(base, ring, ringTop, lid);
  return { group, setOn() {} };
}

/* ---------- Выключатели Яндекса (проводной — в стену, беспроводной — накладной) ----------
   Начало — центр задней стороны; лицо смотрит в +z. */
function buildSwitch(wired) {
  const group = new THREE.Group();
  group.name = wired ? 'Device_WiredSwitch' : 'Device_WirelessSwitch';
  const frameD = wired ? 0.011 : 0.017;
  const white = std(0xf3f3f1, 0.45), gap = std(0x2a2b30, 0.7);

  const frame = plate(0.086, 0.086, frameD, 0.007, 0.0022, white);
  frame.position.z = frameD / 2;
  const gapMesh = plate(0.0745, 0.0745, 0.002, 0.0075, 0.0006, gap);        // тёмный зазор вокруг клавиши
  gapMesh.position.z = frameD + 0.0004;
  const key = plate(0.072, 0.072, 0.0075, 0.0075, 0.0025, white);           // клавиша
  key.position.z = frameD + 0.0028;
  const keyFront = frameD + 0.0028 + 0.00375;
  const led = makeLed(0.0014, 0x9aa4b4, 0xfff2cf, 0.6, 3.0);                // светящаяся точка внизу клавиши
  led.mesh.scale.set(1, 3.2, 0.5);
  led.mesh.position.set(0, -0.0275, keyFront);
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.0034, 20), new THREE.MeshBasicMaterial({ map: logoTexture(), transparent: true }));
  logo.position.set(0.0345, -0.0345, frameD + 0.0003 + 0.0001);
  logo.position.z = frameD + 0.0004;
  group.add(frame, gapMesh, key, led.mesh, logo);
  return { group, setOn: (on) => led.set(on) };
}
export const buildWiredSwitch = () => buildSwitch(true);
export const buildWirelessSwitch = () => buildSwitch(false);

/* ---------- Умная кнопка ----------
   Белый квадрат 43 × 43 × 13 мм со скруглёнными углами, большая круглая кнопка, серый «поясок», светодиод. Начало — центр задней стороны. */
export function buildButton() {
  const group = new THREE.Group();
  group.name = 'Device_Button';
  const white = std(0xf4f4f2, 0.42), grey = std(0xb7bfc0, 0.5);
  const under = plate(0.0425, 0.0425, 0.0045, 0.011, 0.0012, grey);        // серая нижняя часть корпуса
  under.position.z = 0.00225;
  const body = plate(0.043, 0.043, 0.009, 0.0115, 0.0025, white);
  body.position.z = 0.0045 + 0.0045 - 0.0005;
  const front = 0.0045 + 0.009 - 0.0005;
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.0138, 0.014, 0.0016, 36), white);
  btn.rotation.x = Math.PI / 2; btn.position.z = front + 0.0004;
  const btnRing = new THREE.Mesh(new THREE.TorusGeometry(0.0144, 0.00045, 6, 40), std(0x9a9ea3, 0.7));
  btnRing.position.z = front + 0.0001;
  const led = makeLed(0.0011, 0xaab2b8, 0x59b8ff, 0.0, 3.0);
  led.mesh.position.set(-0.0005, -0.0176, front);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.0008, 12), std(0xcfd3d6, 0.5));   // кнопка сопряжения сверху
  pin.rotation.x = Math.PI / 2; pin.position.set(0, 0.0178, front - 0.0006);
  group.add(under, body, btn, btnRing, led.mesh, pin);
  return { group, setOn: (on) => led.set(on) };
}

/* ---------- Умный терморегулятор для радиатора ----------
   Цилиндр вдоль оси z: основание — накидная рифлёная гайка, дальше белый корпус с канавкой и крышкой.
   Дисплей на боковой поверхности (+y), его текстура вырезана с фото. Начало — центр основания.\n   Параметр valve добавляет за основанием короткий клапан (z от −0.028 до 0). */
export function buildThermostat({ valve = false } = {}) {
  const group = new THREE.Group();
  group.name = 'Device_Thermostat';
  const white = std(0xf1f1f0, 0.4);
  if (valve) {   // небольшой хромированный клапан за гайкой (на z < 0), на который головка надета, — крепится к торцу радиатора
    const chrome = std(0xc9ccd1, 0.28, 0.9);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0105, 0.0105, 0.028, 24), chrome);
    stem.rotation.x = Math.PI / 2; stem.position.z = -0.014;
    const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.0140, 0.0140, 0.007, 6), chrome);
    hex.rotation.x = Math.PI / 2; hex.position.z = -0.011;
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.003, 24), chrome);
    flange.rotation.x = Math.PI / 2; flange.position.z = -0.0245;
    group.add(stem, hex, flange);
  }

  const c = document.createElement('canvas');                              // рифление гайки
  c.width = 128; c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#d6d8da'; g.fillRect(0, 0, 128, 16);
  g.fillStyle = '#9a9ea3';
  for (let x = 0; x < 128; x += 8) g.fillRect(x, 0, 3, 16);
  const knurl = new THREE.CanvasTexture(c);
  knurl.colorSpace = THREE.SRGBColorSpace; knurl.wrapS = THREE.RepeatWrapping;
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.009, 36, 1, true), std(0xffffff, 0.45, 0.5, { map: knurl }));
  nut.rotation.x = Math.PI / 2; nut.position.z = 0.0045;

  const body = lathe([[0, 0], [0.0255, 0], [0.0266, 0.0018], [0.0266, 0.0580], [0.0256, 0.0600], [0, 0.0600]], white, 48);
  body.rotation.x = Math.PI / 2; body.position.z = 0.009;                  // y профиля → вдоль z
  const groove = new THREE.Mesh(new THREE.CylinderGeometry(0.0269, 0.0269, 0.0016, 48), std(0xcdd0d4, 0.5));
  groove.rotation.x = Math.PI / 2; groove.position.z = 0.009 + 0.0405;
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.0052, 20), new THREE.MeshBasicMaterial({ map: logoTexture(), transparent: true }));
  logo.position.z = 0.069 + 0.0003;                                         // логотип на торце
  const led = makeLed(0.0011, 0x9aa0a6, 0x59b8ff, 0.0, 3.0);
  led.mesh.position.set(0.0165, 0.0, 0.0688);

  // Дисплей: кусок цилиндра чуть больше корпуса. Ширина вдоль оси z, высота — по дуге, чтобы цифры читались при горизонтальной установке.
  const arc = 0.040 / 0.0266;
  const dTex = loadTexture('textures/thermo_display.png');
  dTex.center.set(0.5, 0.5);
  dTex.rotation = Math.PI / 2;
  const display = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02672, 0.02672, 0.036, 28, 1, true, Math.PI - arc / 2, arc),
    new THREE.MeshBasicMaterial({ map: dTex, transparent: true, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  display.rotation.x = Math.PI / 2; display.position.z = 0.009 + 0.0275;
  group.add(nut, body, groove, logo, led.mesh, display);
  return { group, setOn: (on) => led.set(on) };
}

/* ---------- Умный ИК-пульт ----------
   Диск 80 мм: белая нижняя часть, глянцевая чёрная верхняя, сбоку кнопка и светодиод. Начало — центр низа; лицо в +z. */
export function buildIrRemote() {
  const group = new THREE.Group();
  group.name = 'Device_IrRemote';
  const base = lathe([[0, 0], [0.033, 0], [0.0385, 0.0035], [0.0402, 0.010], [0.0402, 0.0158], [0, 0.0158]], std(0xf4f4f3, 0.4));
  const cap = lathe([[0, 0.0158], [0.0412, 0.0158], [0.0418, 0.0195], [0.0405, 0.0270], [0.0350, 0.0328], [0.0200, 0.0354], [0, 0.0362]], std(0x0b0b0e, 0.07, 0.35), 56);
  const button = rbox(0.0215, 0.0062, 0.0032, 0.0022, std(0xdedfe1, 0.4), 2);
  const phi = -0.46, r = 0.0402;
  button.position.set(r * Math.sin(phi), 0.0075, r * Math.cos(phi)); button.rotation.y = phi;
  const led = makeLed(0.0012, 0x8e949a, 0x59b8ff, 0.0, 3.0);
  const phi2 = -0.12;
  led.mesh.position.set(r * Math.sin(phi2) + 0.0003, 0.0075, r * Math.cos(phi2) + 0.0006);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.0108, 0.0013, 0.0008), std(0x7c8187, 0.6));   // риска на кнопке
  dash.position.set(r * Math.sin(phi) , 0.0075, r * Math.cos(phi) + 0.0018); dash.rotation.y = phi;
  group.add(base, cap, button, led.mesh);
  return { group, setOn: (on) => led.set(on) };
}

/* ---------- Умная IP-камера ----------
   Белый цилиндр с тёмной овальной панелью и объективом. Высота ограничена: верхние кухонные шкафы стоят в 7 см от потолка,
   поэтому камера сделана компактной (70 мм). Начало — центр основания; лицо в +z. */
export function buildCamera() {
  const group = new THREE.Group();
  group.name = 'Device_Camera';
  const shell = std(0xd9d8d3, 0.5);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.0175, 0.0185, 0.008, 32), std(0x9c9b97, 0.55));
  foot.position.y = 0.004;
  const body = lathe([[0, 0.008], [0.0215, 0.008], [0.0225, 0.010], [0.0225, 0.0685], [0.0212, 0.0700], [0, 0.0700]], shell, 48);
  const panel = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), std(0x1a1b20, 0.18, 0.35));   // овальная тёмная панель спереди
  panel.scale.set(0.0148, 0.0245, 0.0042);
  panel.position.set(0, 0.040, 0.0222);
  const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.0086, 0.0016, 10, 32), std(0x3b3d44, 0.4, 0.6));
  lensRing.position.set(0, 0.040, 0.0262);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.0078, 24, 16), std(0x080b16, 0.04, 0.9));
  glass.scale.z = 0.55; glass.position.set(0, 0.040, 0.0252);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 10, 8), std(0x5d79c9, 0.2, 0, { emissive: 0x33498c, emissiveIntensity: 0.8 }));
  shine.position.set(-0.0026, 0.0426, 0.0295);
  const dots = [];
  for (let i = 0; i < 6; i++) {                                              // ИК-подсветка вокруг объектива
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.0009, 8, 6), std(0x4a1a1a, 0.4));
    d.position.set(Math.cos(a) * 0.0122, 0.040 + Math.sin(a) * 0.0122, 0.0253);
    dots.push(d);
  }
  const led = makeLed(0.0011, 0xe9ecef, 0x39ff7a, 0.5, 3.0);                  // индикатор под объективом
  led.mesh.position.set(0, 0.0235, 0.0256);
  const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.0006, 8), std(0x30323a, 0.7));
  mic.rotation.x = Math.PI / 2; mic.position.set(0.0075, 0.0255, 0.0255);
  group.add(foot, body, panel, lensRing, glass, shine, ...dots, led.mesh, mic);
  return { group, setOn: (on) => led.set(on) };
}

/* ---------- Умная эмби-лампа ----------
   Скруглённая «капсула» с матовым плафоном и тёмной подставкой. Выключена — белый пластик; включена — плафон светится
   плавным градиентом (синий → розовый → оранжевый), как на фото. Начало — центр низа. */
export function buildAmbientLamp() {
  const group = new THREE.Group();
  group.name = 'Device_AmbientLamp';
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  const lin = g.createLinearGradient(0, 0, 128, 256);
  lin.addColorStop(0.0, '#4e86ff'); lin.addColorStop(0.45, '#d438c8'); lin.addColorStop(1.0, '#ff6a2c');
  g.fillStyle = lin; g.fillRect(0, 0, 128, 256);
  const rad = g.createRadialGradient(100, 190, 5, 100, 190, 110);
  rad.addColorStop(0, 'rgba(255,80,90,0.85)'); rad.addColorStop(1, 'rgba(255,80,90,0)');
  g.fillStyle = rad; g.fillRect(0, 0, 128, 256);
  const gradient = new THREE.CanvasTexture(c);
  gradient.colorSpace = THREE.SRGBColorSpace;

  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0xf1eff4, roughness: 0.55, metalness: 0, emissive: 0xffffff, emissiveMap: gradient, emissiveIntensity: 0,
  });
  const shade = rbox(0.074, 0.114, 0.074, 0.024, shadeMat, 6);
  shade.position.y = 0.007 + 0.057;
  const stand = rbox(0.064, 0.009, 0.064, 0.0035, std(0x1d2036, 0.5, 0.15), 3);
  stand.position.y = 0.0045;
  group.add(shade, stand);
  return {
    group,
    setOn(on) {   // включена: корпус темнеет, чтобы градиент не выгорал в белый
      shadeMat.emissiveIntensity = on ? 1.5 : 0;
      shadeMat.color.setHex(on ? 0x6d6a78 : 0xf1eff4);
    },
  };
}

/* ---------- Датчик открытия двери и окна ----------
   Два белых «стадиона»: большой датчик и малый магнит. Начало — центр задней стороны большого датчика;
   магнит смещён на +x на 3 см; лицо в +z. */
export function buildDoorSensor() {
  const group = new THREE.Group();
  group.name = 'Device_DoorSensor';
  const white = std(0xf5f5f3, 0.4);
  const stadium = (w, h, d) => {
    const depth = d - 0.0034;
    const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - 0.003, h - 0.003, (w - 0.003) / 2), {
      depth, bevelEnabled: true, bevelThickness: 0.0017, bevelSize: 0.0015, bevelSegments: 3, curveSegments: 14,
    });
    geo.translate(0, 0, -depth / 2);
    return new THREE.Mesh(geo, white);
  };
  const main = stadium(0.0262, 0.0590, 0.0128);
  main.position.z = 0.0064;
  const magnet = stadium(0.0132, 0.0420, 0.0105);
  magnet.position.set(0.030, 0, 0.00525);
  const led = makeLed(0.0008, 0xcfd3d6, 0x39ff7a, 0.0, 3.0);
  led.mesh.position.set(0, 0.0235, 0.0127);
  group.add(main, magnet, led.mesh);
  return { group, setOn: (on) => led.set(on) };
}

/* ---------- Датчик температуры и влажности ----------
   Белый диск 43 мм с круглым ЖК-экраном; экран вырезан с фото (22 °C, 50 %). Начало — центр задней стороны; лицо в +z. */
export function buildTempSensor() {
  const group = new THREE.Group();
  group.name = 'Device_TempSensor';
  const body = lathe([[0, 0], [0.0195, 0], [0.0213, 0.0016], [0.0216, 0.0058], [0.0216, 0.0128], [0.0208, 0.0150], [0, 0.0155]], std(0xf4f4f2, 0.42), 48);
  body.rotation.x = Math.PI / 2;
  const lcdTex = loadTexture('textures/temp_lcd.png');
  const lcd = new THREE.Mesh(
    new THREE.CircleGeometry(0.0158, 40),
    new THREE.MeshStandardMaterial({ map: lcdTex, emissive: 0xffffff, emissiveMap: lcdTex, emissiveIntensity: 0.28, roughness: 0.18, metalness: 0 }),
  );
  lcd.position.z = 0.0156;
  group.add(body, lcd);
  return { group, setOn() {} };
}

/* ---------- Датчик движения и освещённости ----------
   Основание, шарнир и круглая головка с гранёной линзой-«сотами». Начало — центр основания; ось +z — от места крепления
   (для потолка модель поворачивают на 90° вокруг x: тогда она «висит» вниз). */
export function buildMotionSensor() {
  const group = new THREE.Group();
  group.name = 'Device_MotionSensor';
  const white = std(0xf6f6f4, 0.42);
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.0185, 0.0195, 0.008, 32), white);
  mount.rotation.x = Math.PI / 2; mount.position.z = 0.004;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 20, 14), white);
  ball.position.z = 0.0145;
  // Головка наклонена вокруг шарнира
  const pivot = new THREE.Group();
  pivot.position.z = 0.0145;
  pivot.rotation.x = -0.62;
  const head = lathe([[0, 0], [0.0225, 0], [0.0256, 0.003], [0.0256, 0.017], [0.0235, 0.021], [0, 0.0215]], white, 40);
  head.rotation.x = Math.PI / 2; head.position.z = 0.002;
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.0158, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(0xdfe2e5, 0.5, 0, { flatShading: true }));
  lens.rotation.x = Math.PI / 2; lens.scale.set(1, 0.7, 1);
  lens.position.z = 0.0198;
  lens.position.y = 0.0;
  const ledMesh = makeLed(0.0010, 0x3a2a2a, 0xff3b30, 0.0, 3.0);
  ledMesh.mesh.position.set(-0.0175, -0.0105, 0.0195);
  pivot.add(head, lens, ledMesh.mesh);
  group.add(mount, ball, pivot);
  return { group, setOn: (on) => ledMesh.set(on) };
}

/* ---------- Датчик протечки воды ----------
   Низкий белый диск, стенки расширяются кверху, сверху неглубокая вогнутая «тарелка». Начало — центр низа; ось +y. */
export function buildLeakSensor() {
  const group = new THREE.Group();
  group.name = 'Device_LeakSensor';
  const body = lathe([[0, 0], [0.0245, 0], [0.0262, 0.0014], [0.0310, 0.0185], [0.0305, 0.0203], [0.0278, 0.0212], [0.0, 0.0186]], std(0xf5f5f3, 0.33), 56);
  const led = makeLed(0.0012, 0xb0b8bd, 0x39ff7a, 0.0, 3.0);
  led.mesh.position.set(0, 0.0192, 0.016);
  group.add(body, led.mesh);
  return { group, setOn: (on) => led.set(on) };
}

/* Реестр — для страниц предпросмотра и отладки */
export const DEVICE_BUILDERS = {
  midi: buildMidi, outlet: buildOutlet, hub: buildHub, wired: buildWiredSwitch, wireless: buildWirelessSwitch,
  button: buildButton, thermo: buildThermostat, ir: buildIrRemote, camera: buildCamera, ambient: buildAmbientLamp,
  door: buildDoorSensor, temp: buildTempSensor, motion: buildMotionSensor, leak: buildLeakSensor,
};


