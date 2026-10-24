import * as THREE from 'three';

/* Декор квартиры из простых форм. Начало координат — центр задней стороны предмета у стены, лицо смотрит в +z. */

/* Мягкая тень под предметом на стене: прозрачная плоскость с размытым тёмным прямоугольником.
   Реальные тени в сцене выключены (дорого), поэтому тень нарисована текстурой. */
function shadowTexture(aspect) {
  const w = 256, h = Math.round(256 / aspect);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const pad = 52;                                       // запас под размытие
  for (let i = 0; i < 26; i++) {                        // ступенчатый градиент: ближе к центру — темнее
    const grow = (i / 25) * pad;
    g.fillStyle = `rgba(0,0,0,${0.028})`;
    g.beginPath();
    g.roundRect(pad - grow, pad - grow, w - 2 * (pad - grow), h - 2 * (pad - grow), 10 + grow * 0.6);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Постер в тонкой рамке. width × height — внешний размер, м; frame — ширина рамки; mat — ширина паспарту.
   Картинка (PNG с прозрачным фоном) вписывается в поле без растяжения. Задняя сторона отстоит от стены на gap (доли мм),
   чтобы плоскости не мерцали. */
export function buildPoster({ image, width = 0.46, height = 0.69, frame = 0.014, mat = 0.02, depth = 0.018,
                              frameColor = 0x1d1d20, matColor = 0xd8d3c9, brightness = 1.0, gap = 0.0004 }) {
  const group = new THREE.Group();
  group.name = 'Decor_Poster';
  const root = new THREE.Group();                       // сдвиг от стены внутри группы, сама группа остаётся в точке на стене
  root.position.z = gap;
  group.add(root);

  const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.45, metalness: 0.1 });
  const bar = (w, h, x, y) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), frameMat);
    m.position.set(x, y, depth / 2);
    return m;
  };
  root.add(
    bar(width, frame, 0, (height - frame) / 2), bar(width, frame, 0, -(height - frame) / 2),
    bar(frame, height - 2 * frame, (width - frame) / 2, 0), bar(frame, height - 2 * frame, -(width - frame) / 2, 0),
  );

  const innerW = width - 2 * frame, innerH = height - 2 * frame;
  const matMesh = new THREE.Mesh(new THREE.PlaneGeometry(innerW, innerH), new THREE.MeshStandardMaterial({ color: matColor, roughness: 0.9, metalness: 0 }));
  matMesh.position.z = depth * 0.4;                     // паспарту утоплено в рамку
  root.add(matMesh);

  const tex = new THREE.TextureLoader().load(image, (t) => {
    const aspect = t.image.width / t.image.height;
    const areaW = innerW - 2 * mat, areaH = innerH - 2 * mat;
    const w = Math.min(areaW, areaH * aspect), h = w / aspect;
    card.geometry.dispose();
    card.geometry = new THREE.PlaneGeometry(w, h);
    card.visible = true;
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;                                   // QR остаётся чётким при взгляде под углом
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(0.01, 0.01),
    new THREE.MeshLambertMaterial({   // матовая бумага без бликов и отражений окружения: так тёмные модули QR остаются тёмными
      map: tex, color: new THREE.Color(brightness, brightness, brightness),
      transparent: true, alphaTest: 0.02, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
  );
  card.visible = false;                                 // покажется, когда картинка загрузится и будут известны пропорции
  card.position.z = depth * 0.4 + 0.0006;
  root.add(card);

  // Мягкая тень на стене: чуть шире постера и сдвинута вниз (свет сверху)
  const sw = width + 0.14, sh = height + 0.14;
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(sw, sh),
    new THREE.MeshBasicMaterial({
      map: shadowTexture(sw / sh), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }),
  );
  shadow.position.set(0.004, -0.014, gap * 0.4);        // между стеной и тыльной стороной рамки
  group.add(shadow);

  return group;
}


/* ---------- Общее для светящихся подсветок ---------- */

/* Светящийся прозрачный материал: складывается со сценой (аддитивно), не пишет глубину, не зависит от тональной коррекции.
   Стартует с opacity 0 — яркостью управляет setLevel подсветки. polygonOffset нужен, чтобы плоскость, лежащая в долях
   миллиметра от стены, не мерцала. */
function makeAdditive(map, color, extra = {}) {
  return new THREE.MeshBasicMaterial({
    map, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, ...extra,
  });
}

/* Вертикальный градиент для ленты: яркая сердцевина, мягкие края */
function stripGradientTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0.0, 'rgba(255,255,255,0)'); gr.addColorStop(0.32, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(0.68, 'rgba(255,255,255,0.55)'); gr.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
  return new THREE.CanvasTexture(c);
}
/* ---------- Скрытая LED-подсветка по периметру потолка ----------
   Тонкая светящаяся лента у верхнего края стен прямоугольного помещения + слабое свечение на потолке и верхней части стен
   (прозрачные плоскости со светлыми градиентами, складываются со сценой) + один слабый точечный источник.
   Никаких теней и десятков ламп: всё считается почти даром. Включение/выключение плавное: setLevel(0…1) вызывается из кадра.
   Размеры: x0…x1, z0…z1 — внутренние грани стен, ceilingY — потолок. Лента лежит у стены на расстоянии wallOffset
   (чтобы не прорезать её), углы сходятся в общих вершинах: стыки без дыр и наложений. */
export function buildCoveLight({ x0, x1, z0, z1, ceilingY, stripY = ceilingY - 0.06, stripH = 0.034, wallOffset = 0.004,
                                 washBottom = ceilingY - 0.28, color = 0xffc98a, lightIntensity = 1.4 }) {
  const group = new THREE.Group();
  group.name = 'Decor_CoveLight';
  const warm = new THREE.Color(color);

  const stripTexture = stripGradientTexture();   // яркая сердцевина, мягкие края
  // Свечение на стене: сверху ярко (рядом с лентой), вниз быстро гаснет
  const washTexture = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0.0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.28)'); gr.addColorStop(1.0, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    return new THREE.CanvasTexture(c);
  })();
  // Свечение на потолке: ярче у краёв (у ленты), к центру гаснет
  const ceilTexture = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const edge = (x0_, y0_, x1_, y1_, rx, ry, rw, rh) => {
      const gr = g.createLinearGradient(x0_, y0_, x1_, y1_);
      gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
    };
    const t = 40;
    edge(0, 0, 0, t, 0, 0, 128, t); edge(0, 128, 0, 128 - t, 0, 128 - t, 128, t);
    edge(0, 0, t, 0, 0, 0, t, 128); edge(128, 0, 128 - t, 0, 128 - t, 0, t, 128);
    return new THREE.CanvasTexture(c);
  })();

  const additive = (map, extra = {}) => makeAdditive(map, warm, extra);

  // --- лента: четыре вертикальных четырёхугольника по контуру, углы общие ---
  const o = wallOffset;
  const corners = [[x0 + o, z0 + o], [x1 - o, z0 + o], [x1 - o, z1 - o], [x0 + o, z1 - o]];
  const yA = stripY - stripH / 2, yB = stripY + stripH / 2;
  const pos = [], uv = [], idx = [];
  corners.forEach((p, i) => {
    const q = corners[(i + 1) % 4];
    const base = pos.length / 3;
    pos.push(p[0], yA, p[1], q[0], yA, q[1], q[0], yB, q[1], p[0], yB, p[1]);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const stripGeo = new THREE.BufferGeometry();
  stripGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  stripGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  stripGeo.setIndex(idx);
  stripGeo.computeVertexNormals();   // нормали нужны проходу затенения (GTAO): без них лента рисуется чёрной; порядок вершин даёт нормали внутрь помещения
  const stripMat = additive(stripTexture, { side: THREE.DoubleSide, color: new THREE.Color(1.0, 0.86, 0.62), polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const strip = new THREE.Mesh(stripGeo, stripMat);
  group.add(strip);

  // --- свечение на верхней части стен: по плоскости на стену, не ниже washBottom (выше дверных проёмов) ---
  const washH = ceilingY - washBottom, washY = ceilingY - washH / 2;
  const washMat = additive(washTexture);
  const wall = (len, cx, cz, ry, off) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, washH), washMat);
    m.position.set(cx + off[0], washY, cz + off[1]); m.rotation.y = ry;
    return m;
  };
  const w = x1 - x0, d = z1 - z0, e = o * 0.6;
  group.add(
    wall(w, (x0 + x1) / 2, z0, 0, [0, e]),               // северная стена (z0), лицом на +z
    wall(w, (x0 + x1) / 2, z1, Math.PI, [0, -e]),        // южная (z1), лицом на −z
    wall(d, x0, (z0 + z1) / 2, Math.PI / 2, [e, 0]),     // западная (x0), лицом на +x
    wall(d, x1, (z0 + z1) / 2, -Math.PI / 2, [-e, 0]),   // восточная (x1), лицом на −x
  );

  // --- свечение на потолке ---
  const ceilMat = additive(ceilTexture);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat);
  ceil.rotation.x = Math.PI / 2;                          // лицом вниз
  ceil.position.set((x0 + x1) / 2, ceilingY - 0.004, (z0 + z1) / 2);
  group.add(ceil);

  // --- один слабый тёплый источник у потолка: мягко подсвечивает мебель и верх стен; радиус короткий, чтобы не заходить в соседние комнаты ---
  const light = new THREE.PointLight(color, 0, 2.3, 2);
  light.position.set((x0 + x1) / 2, ceilingY - 0.5, (z0 + z1) / 2);   // не вплотную к потолку, иначе на нём яркое пятно
  group.add(light);

  // Светящиеся элементы прячем целиком, когда подсветка выключена. Сам источник света остаётся в сцене всегда (intensity 0):
  // иначе при включении число ламп меняется и three.js перекомпилирует все шейдеры — на тяжёлой сцене это заметный рывок.
  const visuals = group.children.filter((c) => c !== light);
  visuals.forEach((v) => { v.visible = false; });
  return {
    group,
    /* level: 0 — выключено, 1 — горит; значения между — плавный переход */
    setLevel(level) {
      const on = level > 0.001;
      visuals.forEach((v) => { v.visible = on; });
      stripMat.opacity = level;
      washMat.opacity = level * 0.5;
      ceilMat.opacity = level * 0.6;
      light.intensity = level * lightIntensity;
    },
  };
}

/* ---------- Подсветка за изголовьем кровати ----------
   Изголовье — прямоугольная панель у стены с закруглёнными верхними углами. Лента идёт по её контуру (по бокам и по верху)
   на стене, внутри контура с отступом inset, и прикрыта панелью — виден только мягкий ореол на стене вокруг изголовья.
   Ореол — одна полупрозрачная плоскость с градиентом, который гаснет от контура наружу. Источников света нет.
   Модель смотрит в сторону +x → стена с нормалью −x; координаты (z, y) задаются в мировых метрах.
   wallX — плоскость стены; zMin…zMax и yTop — габариты изголовья; cornerR — радиус верхних углов. */
export function buildHeadboardGlow({ wallX, zMin, zMax, yTop, cornerR = 0.08, inset = 0.035, stripWidth = 0.018,
                                     margin = 0.55, color = 0xffc98a }) {
  const group = new THREE.Group();
  group.name = 'Decor_HeadboardGlow';
  const warm = new THREE.Color(color);

  // Контур [z, y] снизу вверх по левому краю, дугой, по верху, дугой, вниз по правому краю (inset — отступ внутрь панели)
  const path = (d) => {                       // d > 0 — сдвиг контура наружу, d < 0 — внутрь
    const zl = zMin - d, zr = zMax + d, yt = yTop + d, r = Math.max(cornerR + d, 0.005), pts = [];
    pts.push([zl, 0], [zl, yt - r]);
    for (let i = 1; i < 10; i++) { const a = Math.PI / 2 * (i / 10); pts.push([zl + r - Math.cos(a) * r, yt - r + Math.sin(a) * r]); }
    pts.push([zl + r, yt], [zr - r, yt]);
    for (let i = 1; i < 10; i++) { const a = Math.PI / 2 * (i / 10); pts.push([zr - r + Math.sin(a) * r, yt - r + Math.cos(a) * r]); }
    pts.push([zr, yt - r], [zr, 0]);
    return pts;
  };

  // --- лента: непрерывная полоса по контуру; у каждой вершины берётся общая нормаль, поэтому на изгибах нет щелей и наложений ---
  const line = path(-inset);
  const pos = [], uv = [], idx = [];
  const wallFace = wallX - 0.0012;           // лента на стене, перед ней; панель изголовья (до wallX − 0.005) закрывает её спереди
  line.forEach((p, i) => {
    const a = line[Math.max(i - 1, 0)], b = line[Math.min(i + 1, line.length - 1)];
    let tz = b[0] - a[0], ty = b[1] - a[1]; const len = Math.hypot(tz, ty) || 1; tz /= len; ty /= len;
    const nz = -ty, ny = tz, h = stripWidth / 2;
    pos.push(wallFace, p[1] + ny * h, p[0] + nz * h, wallFace, p[1] - ny * h, p[0] - nz * h);
    uv.push(0, i / (line.length - 1), 1, i / (line.length - 1));
    if (i < line.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  });
  const stripGeo = new THREE.BufferGeometry();
  stripGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  stripGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  stripGeo.setIndex(idx);
  stripGeo.computeVertexNormals();           // нужны проходу затенения GTAO, без них лента рисуется чёрной
  const stripTex = stripGradientTexture();
  stripTex.center.set(0.5, 0.5); stripTex.rotation = Math.PI / 2;   // градиент поперёк ленты
  const stripMat = makeAdditive(stripTex, warm.clone().set(1.0, 0.86, 0.62), { side: THREE.DoubleSide, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  group.add(new THREE.Mesh(stripGeo, stripMat));

  // --- ореол: градиент гаснет от контура наружу (накопление расширяющихся контуров даёт плавное квадратичное затухание) ---
  const w = (zMax - zMin) + 2 * margin, h = yTop + margin;
  const cw = 512, chh = Math.round(512 * h / w);
  const c = document.createElement('canvas'); c.width = cw; c.height = chh;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cw, chh);
  g.globalCompositeOperation = 'lighter';
  const toPx = (p) => [((p[0] - (zMin - margin)) / w) * cw, chh - (p[1] / h) * chh];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const d = margin * (i / N) * 0.98;
    const pts = path(d).map(toPx);
    pts.unshift([pts[0][0], chh + 4]); pts.push([pts[pts.length - 1][0], chh + 4]);   // замыкаем вниз, за край (пол)
    g.fillStyle = `rgba(255,255,255,${0.085 * (1 - i / N)})`;
    g.beginPath(); pts.forEach((q, k) => (k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); g.fill();
  }
  const haloTex = new THREE.CanvasTexture(c);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  const haloMat = makeAdditive(haloTex, warm, { blending: THREE.AdditiveBlending });
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), haloMat);
  halo.rotation.y = -Math.PI / 2;            // нормаль −x: лицом в комнату; локальный +x плоскости = мировой +z
  halo.position.set(wallX - 0.0025, h / 2, (zMin + zMax) / 2);
  group.add(halo);

  const visuals = group.children.slice();
  visuals.forEach((v) => { v.visible = false; });
  return {
    group,
    /* level: 0 — выключено, 1 — горит */
    setLevel(level) {
      const on = level > 0.001;
      visuals.forEach((v) => { v.visible = on; });
      stripMat.opacity = level;
      haloMat.opacity = level * 0.9;
    },
  };
}
