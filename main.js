import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';   // распаковка геометрии в сжатой модели (EXT_meshopt_compression)
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createOutdoors } from './outdoors.js';
import { buildPoster, buildCoveLight, buildHeadboardGlow } from './decor.js';
import {
  buildMidi, buildOutlet, buildHub, buildWiredSwitch, buildWirelessSwitch, buildButton, buildThermostat,
  buildIrRemote, buildCamera, buildAmbientLamp, buildDoorSensor, buildTempSensor, buildMotionSensor, buildLeakSensor,
} from './devices3d.js';

/* =====================================================================
   НАСТРОЙКИ — ЗДЕСЬ ТЫ БУДЕШЬ МЕНЯТЬ ПОЧТИ ВСЁ
   ===================================================================== */

/* Сжатая модель для сайта (геометрия meshopt, текстуры WebP, ~30 МБ). Исходник 353 МБ лежит в backup/floor_plan_2.glb. */
const MODEL_URL = 'floor_plan_2_web.glb';

/* Маршрут камеры: точки, через которые «проезжает» камера при скролле.
   Координаты в метрах, как в Blender (но ось Y в сайте = ВВЕРХ).
   Маршрут рассчитан по реальным размерам модели (см. ниже).
   Чтобы поправить: нажми D на сайте, подлети в нужное место,
   нажми P — координаты появятся в консоли браузера (F12).
   Потом вставь их сюда. Точек камеры и точек взгляда должно быть поровну. */
/* Размеры по модели floor_plan_2.glb (метры, масштаб 1:1, пол y = 0):
   стены x −3.4…3.25, z −3.8…3.16, высота 2.4.
   Вход — юг (z ≈ 3). Прихожая в центре (x −1.2…1.2, z 1.4…3).
   Из неё на север: дверь в кухню (x ≈ −0.6, z ≈ 1.2) и дверь в комнату (x ≈ 0.8, z ≈ 1.2).
   Лоджия — северо-запад (x −3.1…−0.5, z −3.75…−2.5), вход с кухни в точке (−1.53, −2.28).
   Ванная: x −3.1…−1.2, z 1.3…2.95, дверь из прихожей в точке (−1.12, 1.83).
   Порядок: прихожая → комната → прихожая → ванная → прихожая → кухня → лоджия. */
let CAMERA_POINTS = [
  [-0.20, 1.6,  2.75],   // прихожая, у входа
  [ 0.10, 1.6,  2.00],
  [ 0.80, 1.6,  1.55],   // перед дверью в комнату
  [ 0.80, 1.6,  1.10],   // дверной проём
  [ 1.00, 1.6,  0.20],   // комната
  [ 1.30, 1.6, -0.90],
  [ 1.50, 1.6, -2.10],   // у окна, над кроватью
  [ 1.20, 1.6, -0.80],   // назад
  [ 0.95, 1.6,  0.30],
  [ 0.80, 1.6,  1.10],   // дверной проём
  [ 0.40, 1.6,  1.90],   // прихожая
  [-0.35, 1.6,  1.85],   // прихожая → ванная
  [-0.85, 1.6,  1.83],
  [-1.12, 1.6,  1.83],   // дверной проём в ванную
  [-1.65, 1.6,  1.88],   // ванная
  [-2.20, 1.6,  1.95],   // у ванны
  [-2.05, 1.6,  1.80],
  [-1.65, 1.6,  1.85],   // назад
  [-1.12, 1.6,  1.83],   // дверной проём
  [-0.70, 1.6,  1.72],   // прихожая
  [-0.60, 1.6,  1.50],   // перед дверью на кухню
  [-0.60, 1.6,  1.00],   // дверной проём
  [-0.80, 1.6,  0.30],   // кухня: дальше идём по прямой от двери (−0.60, 1.00) к проёму на лоджию (−1.53, −2.28)
  [-1.00, 1.6, -0.40],
  [-1.20, 1.6, -1.10],
  [-1.41, 1.6, -1.85],   // перед выходом на лоджию
  [-1.53, 1.6, -2.28],   // проём на лоджию
  [-1.70, 1.6, -3.00],   // лоджия
  [-1.90, 1.6, -3.30],
];
let LOOK_POINTS = [
  [-0.40, 1.4,  0.80],
  [ 0.80, 1.4,  0.80],
  [ 1.00, 1.4,  0.00],
  [ 1.40, 1.3, -1.00],
  [ 1.80, 1.2, -2.00],
  [ 1.60, 1.4, -3.80],
  [ 1.55, 1.3, -3.80],   // смотрим на окно
  [ 1.10, 1.4,  1.00],
  [ 0.80, 1.4,  1.50],
  [ 0.40, 1.4,  2.60],   // разворот к прихожей
  [-0.60, 1.4,  1.20],
  [-1.60, 1.3,  1.85],   // смотрим в ванную
  [-2.40, 1.3,  1.95],
  [-2.70, 1.3,  2.00],
  [-3.00, 1.4,  1.85],   // зеркало и раковина
  [-2.65, 0.7,  2.70],   // ванна и душ
  [-1.55, 0.8,  1.00],   // унитаз
  [-0.80, 1.4,  1.80],   // разворот к выходу
  [-0.20, 1.4,  1.70],
  [-0.60, 1.4,  1.00],   // к двери на кухню
  [-0.60, 1.4,  0.00],
  [-1.20, 1.4, -1.90],   // на кухне смотрим вперёд, на лоджию (без поворота к мойке и плите)
  [-1.40, 1.4, -2.70],
  [-1.50, 1.4, -3.10],
  [-1.55, 1.4, -3.30],
  [-1.55, 1.4, -3.50],
  [-1.55, 1.4, -3.50],
  [-2.60, 1.3, -3.40],   // лоджия, лампа
  [-1.40, 1.3, -3.80],
];

/* Скрываем то, что мешает пройти или не должно быть видно:
   закрытые двери, служебные CTRL_* из Blender, дверь на лоджию (Window.001)
   и три «гигантских» объекта (сотни метров), которые портили масштаб.
   Имена сравниваются без точек, пробелов и подчёркиваний — так их оставляет GLTFLoader. */
const HIDE_NODES = /^(Door00[1-4]|Handle(Back|Front)(00[1-3])?|CTRL.*|Window001|20x20007|20x20pezinho001|Bolt012|Cylinder0(09|1[0-7]))$/i;
/* Cylinder.009–017 (материал carpet_strands.003) — «ворсинки» ковра высотой до 1.55 м, которые в модели
   отвязаны от ковров и торчат из западной стены комнаты над комодом (x −0.18…0.14, z −1.38…0.12). */

/* Объекты, которые убираем из сцены насовсем (в отличие от HIDE_NODES — освобождается и память).
   Имена — без точек, пробелов и «_», как в HIDE_NODES. */
const REMOVE_NODES = /^(Gorenjefridgefreezer|Plane003)$/i;
/* Gorenje fridge freezer — холодильник на кухне.
   Plane.003 (материал Madeira_fina007) — безымянная деревянная «коробка» 2 × 1.9 × 2 м под полом в центре квартиры
   (x −1…1, y −1.89…0.02, z −1…1), остаток сломанной группы «Industrial shelf wardobre». */

/* Датчик протечки: на полу перед ванной (ванна x −3.07…−1.27, z 2.23…2.94). Метка висит чуть выше самого датчика. */
const LEAK_SENSOR_POS = [-2.20, 0.12, 2.14];

/* Устройства. position — где стоит метка [x, y, z] в метрах
   (подбирается через режим D/P, см. выше). */
const DEVICES = [
  {
    icon: '🔊', title: 'Яндекс Станция с Алисой',
    text: 'Голосовой центр дома. Скажите «Алиса, включи свет» — и она управляет всеми устройствами экосистемы.',
    buyUrl: null,   // ссылки на Миди пока нет — кнопка «Купить» не показывается; впиши ссылку сюда, и она появится
    button: ['Разбудить Алису', 'Алиса слушает…'], position: [1.80, 0.90, 0.95], light: false, room: 'living',   // над колонкой на столе
    /* model — 3D-модель из devices3d.js: build() создаёт её; position — точка крепления (у напольных и настольных
       моделей — центр низа, у настенных — центр задней стороны на стене); rotationY — поворот вокруг вертикали
       (лицо модели смотрит в +z); tiltX — наклон вокруг x (π/2 — потолок, −π/2 — лицом вверх); rollZ — поворот вокруг своей оси z. */
    model: { build: buildMidi, position: [1.80, 0.67, 0.95], rotationY: Math.PI + 0.38 },   // стол x 1.53…2.93, столешница y 0.67
  },
  {
    icon: '💡', title: 'Умная лампа',
    text: 'Регулируется голосом и из приложения: яркость, цветовая температура, сценарии «Вечер» и «Кино».',
    buyUrl: 'https://t.me/smarthomewithAlice/19',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить свет', 'Выключить свет'], position: [2.71, 1.35, -3.05], light: true, lightIntensity: 12, room: 'living',      // прикроватная лампа; яркость света (было 30 по умолчанию)
  },
  {
    icon: '🌡️', title: 'Умный термостат',
    text: 'Поддерживает комфортную температуру и экономит энергию, когда никого нет дома.',
    buyUrl: 'https://t.me/smarthomewithAlice/79',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить обогрев', 'Обогрев включён'], position: [-1.11, 0.66, -2.015], light: false, room: 'kitchen', // над головкой в верхнем левом углу радиатора (с кухни)
    model: { build: () => buildThermostat({ valve: true }), position: [-1.076, 0.52, -2.015], rotationY: -Math.PI / 2, rollZ: -Math.PI / 2 },   // верхний левый угол радиатора: западный торец x −1.05, клапан z −0.028…0 → x −1.078…−1.05, головка смотрит на запад (−x), дисплей в комнату (+z)
  },
  {
    icon: '🪟', title: 'Умные шторы',
    text: 'Открываются по расписанию или по команде. Утром шторы сами встречают вас дневным светом.',
    buyUrl: 'https://t.me/smarthomewithAlice/75',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Открыть шторы', 'Закрыть шторы'], position: [1.45, 1.50, -3.00], light: false, room: 'living',      // штора на окне комнаты (см. CURTAIN)
    onToggle: (on) => setCurtainOpen(on),                                                          // on = штора открыта
  },
  {
    icon: '💧', title: 'Датчик протечки воды',
    text: 'Лежит на полу у ванны и следит за влагой. При протечке пришлёт уведомление и подаст сигнал, а умный кран перекроет воду.',
    buyUrl: 'https://t.me/smarthomewithAlice/71',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить защиту', 'Защита включена'], position: LEAK_SENSOR_POS, light: false, room: 'bath',        // на полу у ванны
    model: { build: buildLeakSensor, position: [-2.20, 0, 2.14] },                                  // на полу перед ванной
  },
  /* Новые устройства. Координаты взяты из габаритов мебели в floor_plan_2.glb (лучи по геометрии модели);
     подправить можно через режим D/P. */
  {
    icon: '🔌', title: 'Умная розетка',
    text: 'Включает и выключает любую технику по голосу, из приложения или по расписанию, а ещё показывает, сколько электричества потребляет прибор.',
    buyUrl: 'https://t.me/smarthomewithAlice/5',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить розетку', 'Розетка включена'], position: [-3.00, 1.21, -0.45], light: false, room: 'kitchen',   // над розеткой на фартуке гарнитура
    model: { build: buildOutlet, position: [-3.076, 1.10, -0.45], rotationY: Math.PI / 2 },   // фартук x −3.076, лицом в кухню (+x)
  },
  {
    icon: '📡', title: 'Умный хаб Яндекса',
    text: 'Соединяет датчики, выключатели и приборы без Wi-Fi в одну сеть и передаёт им команды Алисы.',
    buyUrl: 'https://t.me/smarthomewithAlice/35?single',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить хаб', 'Хаб работает'], position: [0.09, 1.56, 0.10], light: false, room: 'living',            // над хабом на полке у входа в комнату, слева
    model: { build: buildHub, position: [0.085, 1.463, 0.10] },                                // нижняя полка y 1.463, кактус стоит дальше (z 0.24…0.35)
  },
  {
    icon: '🎚️', title: 'Умный выключатель',
    text: 'Встроен в стену вместо обычного. Свет в коридоре включается кнопкой, голосом или по сценарию, например «Я дома».',
    buyUrl: 'https://t.me/smarthomewithAlice/47',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить свет', 'Выключить свет'], position: [-0.92, 1.20, 2.88], light: false, room: 'hall',   // коридор, слева от входной двери
    onToggle: (on) => setHallCove(on),                                                              // on = подсветка по периметру потолка горит
    model: { build: buildWiredSwitch, position: [-0.92, 1.10, 2.961], rotationY: Math.PI },    // стена прихожей z 2.961, лицом в коридор (−z)
  },
  {
    icon: '🔘', title: 'Умная кнопка',
    text: 'Одно нажатие запускает сценарий, например «Приготовить ужин»: включит подсветку, музыку и вытяжку. Двойное и долгое нажатия можно настроить на другие действия.',
    buyUrl: 'https://t.me/smarthomewithAlice/59',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить сценарий', 'Сценарий запущен'], position: [-3.00, 1.31, -1.90], light: false, room: 'kitchen',   // кухня, между верхним и нижним гарнитуром
    model: { build: buildButton, position: [-3.076, 1.25, -1.90], rotationY: Math.PI / 2 },    // фартук между шкафами (y 0.89…1.61)
  },
  {
    icon: '🚪', title: 'Датчик открытия двери',
    text: 'Следит за входной дверью и сообщает, когда её открыли. Можно получить уведомление или запустить сценарий «Кто-то пришёл».',
    buyUrl: 'https://t.me/smarthomewithAlice/65',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить охрану', 'Охрана включена'], position: [0.10, 2.05, 3.00], light: false, room: 'hall',        // входная дверь
    model: { build: buildDoorSensor, position: [0.115, 1.95, 3.07], rotationY: Math.PI },      // полотно двери z 3.07 (утоплено в коробку), лицом в прихожую
  },
  {
    icon: '📈', title: 'Датчик температуры',
    text: 'Измеряет температуру и влажность воздуха в комнате. По его показаниям Алиса может включить кондиционер или обогрев.',
    buyUrl: 'https://t.me/smarthomewithAlice/68',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить датчик', 'Датчик работает'], position: [2.72, 1.60, 1.10], light: false, room: 'living',       // полка над рабочим столом
    model: { build: buildTempSensor, position: [2.72, 1.5085, 1.187], rotationY: Math.PI },    // стоит ребром на нижней доске полки (y 1.487) у задней стенки z 1.187
  },
  {
    icon: '🎛️', title: 'Умный пульт',
    text: 'Заменяет инфракрасный пульт от кондиционера: температуру и режим можно менять голосом и из приложения, а по расписанию климат поддерживается сам.',
    buyUrl: 'https://t.me/smarthomewithAlice/81',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить кондиционер', 'Кондиционер включён'], position: [0.22, 1.08, -1.36], light: false, room: 'living',   // под телевизором
    model: { build: buildIrRemote, position: [0.20, 1.001, -1.36], rotationY: Math.PI / 2 },   // верх тумбы под ТВ y 1.001, лицом в комнату (+x)
  },
  {
    icon: '📹', title: 'Умная IP-камера',
    text: 'Показывает, что происходит на кухне, и присылает уведомление при движении.',
    buyUrl: 'https://t.me/smarthomewithAlice/83',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить камеру', 'Камера записывает'], position: [-2.72, 2.20, 0.40], light: false, room: 'kitchen',    // под камерой на фасаде шкафа (выше — потолок)
    model: { build: buildCamera, position: [-2.785, 2.328, 0.40], rotationY: Math.PI / 2 },     // у переднего края крышки верхнего шкафа (y 2.328, до потолка 7 см), смотрит в кухню
  },
  {
    icon: '🌙', title: 'Умная ambient-лампа',
    text: 'Создаёт вечерний уют: мягкий тёплый свет, плавные переходы цвета и сценарии «Ужин» и «Релакс».',
    buyUrl: 'https://t.me/smarthomewithAlice/84',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить подсветку', 'Подсветка включена'], position: [-0.50, 0.92, -0.97], light: true, lightIntensity: 1.2, lightColor: 0xffb4d8, room: 'kitchen',   // кухонный стол, мягкий розоватый свет
    model: { build: buildAmbientLamp, position: [-0.50, 0.72, -0.97], rotationY: 0.4 },         // столешница y 0.72
  },
  {
    icon: '🕹️', title: 'Беспроводной выключатель',
    text: 'Накладной выключатель без проводов: его можно положить на тумбочку или приклеить на стену. Нажатие включает свет у кровати.',
    buyUrl: 'https://t.me/smarthomewithAlice/38',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить подсветку', 'Выключить подсветку'], position: [2.60, 0.74, -2.87], light: false, room: 'living',   // тумбочка у кровати
    onToggle: (on) => setGlow(headboardGlow, on),                                                  // on = подсветка за изголовьем горит
    model: { build: buildWirelessSwitch, position: [2.60, 0.655, -2.87], tiltX: -Math.PI / 2 },   // лежит на тумбочке (y 0.655) клавишей вверх
  },
  {
    icon: '🏃', title: 'Датчик движения',
    text: 'Висит под потолком в коридоре и замечает движение. Ночью включит неяркий свет, а когда в квартире никого нет, сообщит о посторонних.',
    buyUrl: 'https://t.me/smarthomewithAlice/62',   // ссылка кнопки «Купить» в карточке (пост в Телеграм-канале)
    button: ['Включить датчик', 'Датчик следит'], position: [0.90, 2.25, 2.70], light: false, room: 'hall',         // коридор, под потолком
    model: { build: buildMotionSensor, position: [0.90, 2.40, 2.70], tiltX: Math.PI / 2, rotationY: Math.PI },   // крепится к потолку (y 2.40), смотрит вглубь коридора (−z)
  },
];

/* Шторы. В модели объект «Grey Blackout Curtain with Lace panel» лежит плашмя
   (карниз на z = −1.56, штора «свисает» вдоль +z, толщина по y; трансформации у узла нет).
   Поворачиваем на 90° вокруг X (вниз = −y, от стены = +z), уменьшаем под окно комнаты
   (оригинал 3.4 × 2.9 м — выше потолка 2.4 м) и ставим у северной стены.
   Меш в локальных осях: x — ширина, y — толщина, z — высота. */
const CURTAIN = {
  name: 'GreyBlackoutCurtainwithLacepanel',
  scale: [0.66, 0.78, 0.78],   // ширина, толщина, высота
  centerX: 1.45,               // центр шторы по x (окно комнаты x 0.55…2.55)
  topY: 2.30,                  // высота карниза над полом
  wallZ: -3.37,                // z, где стоят кронштейны (внутренняя грань стены −3.45 + зазор до радиатора)
  local: { centerX: 0.247, topZ: -1.56 },   // центр и верх карниза в исходной геометрии
  /* Открытая штора: ткань и тюль делятся пополам, половины собираются к краям окна — влево и вправо
     (карниз остаётся на месте). */
  open: {
    width: 0.28,     // во сколько раз сжимается ширина каждой половины (1 — не двигается)
    depth: 1.45,     // во сколько раз «вспухают» складки в сторону комнаты
    seconds: 1.8,    // длительность открытия/закрытия
  },
};

const HOTSPOT_RANGE = 3.5;  // метки дальше этого расстояния от камеры не показываем (иначе видны сквозь стены)

/* Комнаты — прямоугольники в плане (x, z в метрах; границы по осям стен и дверных проёмов в floor_plan_2.glb).
   Метка устройства показывается, если камера в той же комнате (поле room у устройства) или если устройство
   видно из камеры напрямую, без стен на пути, — например через открытый дверной проём.
   Новая комната: добавь строку сюда и пиши её id в поле room у устройств. */
const ROOMS = {
  hall:     { name: 'Прихожая',      x: [-1.14, 1.33], z: [1.22, 3.30] },
  bath:     { name: 'Ванная',        x: [-3.50, -1.14], z: [1.22, 3.30] },
  wardrobe: { name: 'Гардеробная',   x: [1.33, 3.40],  z: [1.22, 3.30] },   // за дверью справа от прихожей; устройств пока нет
  kitchen:  { name: 'Кухня',         x: [-3.50, -0.07], z: [-2.20, 1.22] },
  loggia:   { name: 'Лоджия',        x: [-3.50, -0.07], z: [-4.00, -2.20] },  // устройств пока нет
  living:   { name: 'Жилая комната', x: [-0.07, 3.40], z: [-4.00, 1.22] },
};
const HOTSPOT_ROOM_DELAY = 150;   // мс: смена «показать/скрыть» из-за комнаты должна продержаться, иначе метки мигают на границе
const HOTSPOT_LOS_INTERVAL = 120; // мс: как часто проверять прямую видимость сквозь проёмы (луч через стены — не каждый кадр)

/* Цвет стен и освещение. В модели у меша Walls нет материала, и three.js подставляет
   «металлический» по умолчанию — стены выходят тёмными. Поэтому задаём матовый материал сами. */
const WALL_COLOR = 0xE8D5C4;       // тёплый бежево-персиковый
const WALL_ROUGHNESS = 0.92;
const CEILING_COLOR = 0xF4ECE3;    // потолок — чуть светлее стен
const CEILING_GLOW = 0.35;         // собственная подсветка потолка (0…1), иначе он выходит темнее стен: свет идёт сверху
const EXPOSURE = 1.1;              // общая яркость кадра (было 1.0)
const AMBIENT_LIGHT = 1.2;         // мягкий общий свет сверху/снизу
const ENV_INTENSITY = 0.5;         // подсветка от «окружения» — осветляет тёмные углы и металл
const KEY_LIGHT = 1.6;             // направленный свет: стены, повёрнутые к нему, светлее — так видны углы между стенами
const FILL_LIGHT = 0.5;            // слабый встречный свет, чтобы теневые стены не чернели

/* Затенение в углах (ambient occlusion): стыки стен, стен с полом и потолком темнеют — сразу видно, где одна стена
   кончается и начинается другая. Если сайт тормозит на слабой видеокарте — поставь AO_ENABLED = false. */
const AO_ENABLED = true;
const AO_RADIUS = 0.7;             // метры: на каком расстоянии от угла работает затенение
const AO_STRENGTH = 1.0;           // 0…1, насколько сильно затемнять
const LOGGIA_LIGHT = 22;           // мягкий тёплый свет на лоджии (0 — выключить)

const EYE_HEIGHT = 1.6;      // высота камеры над полом, метры
const SMOOTHING  = 0.06;     // плавность скролла (меньше = плавнее)

/* Обзор мышью: зажми левую кнопку и тяни — камера поворачивается на месте (ракурс держится после отпускания).
   Как только начнёшь скроллить, взгляд плавно возвращается на маршрут. */
const LOOK_SENSITIVITY = 0.0035;   // радиан на пиксель
const LOOK_MAX_PITCH = 1.2;        // предел взгляда вверх/вниз, радианы (~70°)
const LOOK_RETURN_TIME = 0.35;     // постоянная времени возврата, секунды (больше = медленнее)

/* ===================================================================== */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = EXPOSURE;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0f14);
const outdoors = createOutdoors(scene);   // дневной вид за окнами: небо, двор, соседние дома (outdoors.js)

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.05, 200);

// Освещение (если в модели из Blender своего света нет — без этого будет темно)
scene.add(new THREE.HemisphereLight(0xfff4ea, 0x7a7168, AMBIENT_LIGHT));
// Два направленных источника с разных сторон: стены разной ориентации получают разную яркость
const sun = new THREE.DirectionalLight(0xfff1e0, KEY_LIGHT);
sun.position.set(6, 8, 5);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xdbe6ff, FILL_LIGHT);
fill.position.set(-6, 5, -5);
scene.add(fill);

// Мягкое окружение: даёт свет из всех направлений, в том числе в углы, куда не достают лампы
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

if (LOGGIA_LIGHT > 0) {
  const loggia = new THREE.PointLight(0xffe2c0, LOGGIA_LIGHT, 7);
  loggia.position.set(-1.9, 2.1, -3.1);   // потолок лоджии (x −3.1…−0.5, z −3.75…−2.5)
  scene.add(loggia);
}

/* Постобработка: сцена → затенение в углах (GTAO) → вывод с тональной коррекцией.
   Затенение считается только по интерьеру: небо, дома и деревья за окнами в расчёт не берём. */
let composer = null;
if (AO_ENABLED) {
  const pixelRatio = renderer.getPixelRatio();
  const target = new THREE.WebGLRenderTarget(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio, {
    type: THREE.HalfFloatType,
    samples: 4,   // сглаживание краёв (MSAA), иначе при постобработке появляются «лесенки»
  });
  composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));

  const gtao = new GTAOPass(scene, camera, window.innerWidth * pixelRatio, window.innerHeight * pixelRatio);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = AO_STRENGTH;
  gtao.updateGtaoMaterial({ radius: AO_RADIUS, distanceExponent: 1, thickness: 1, scale: 1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 16 });
  const overrideVisibility = gtao.overrideVisibility.bind(gtao);
  gtao.overrideVisibility = () => {
    overrideVisibility();
    outdoors.root.visible = false;   // на время расчёта AO — без улицы (прежняя видимость восстановится сама)
  };
  composer.addPass(gtao);
  composer.addPass(new OutputPass());
}

// Режим отладки: D — свободный полёт, P — вывести координаты в консоль
const controls = new OrbitControls(camera, canvas);
controls.enabled = false;
let debugMode = false;

/* Осмотр вблизи: index.html?view=x,y,z,tx,ty,tz ставит камеру в точку (x, y, z) и направляет её на (tx, ty, tz) —
   как режим D, только сразу с нужного места. Удобно, чтобы рассмотреть 3D-модель устройства. */
function applyViewParam() {
  const v = (new URLSearchParams(location.search).get('view') || '').split(',').map(Number);
  if (v.length !== 6 || !v.every(Number.isFinite)) return;
  camera.position.set(v[0], v[1], v[2]);
  controls.target.set(v[3], v[4], v[5]);
  debugMode = true;
  controls.enabled = true;
  if (new URLSearchParams(location.search).get('glow') === '1') glows.forEach((g) => { g.target = 1; });   // &glow=1 — сразу с включёнными подсветками (для осмотра)
}

let modelRoot = null;
let cameraCurve = null;
let lookCurve = null;
let hotspotEls = [];
let activeDevice = null;
const deviceState = new Map();   // title -> включено/выключено
const deviceLights = new Map();  // title -> PointLight
const deviceModelGroups = [];    // 3D-модели устройств (devices3d.js) — по ним ловим клики

/* ---------- Загрузка модели ---------- */
const loaderEl = document.getElementById('loader');
const fillEl = document.getElementById('loader-fill');
const textEl = document.getElementById('loader-text');

new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
  MODEL_URL,
  (gltf) => {
    scene.add(gltf.scene);
    modelRoot = gltf.scene;
    setupAfterLoad(gltf.scene);
    loaderEl.classList.add('done');
  },
  (e) => {
    if (e.total) {
      const p = Math.round((e.loaded / e.total) * 100);
      fillEl.style.width = p + '%';
      textEl.textContent = `Загружаем квартиру… ${p}%`;
    } else {
      textEl.textContent = `Загружаем квартиру… ${(e.loaded / 1048576).toFixed(0)} МБ`;
    }
  },
  (err) => {
    console.error(err);
    textEl.textContent = 'Не удалось загрузить модель. Открой консоль (F12) — там причина.';
  }
);

function setupAfterLoad(model) {
  // Модель уже в метрах (1:1), масштабировать не нужно.
  // Раньше размеры считались по всей сцене, а в ней есть гигантские посторонние
  // объекты — из-за них квартира «сжималась» в 100 раз. Теперь они скрыты.
  const toRemove = [];
  model.traverse((o) => {
    const key = o.name.replace(/[\s_.]/g, '');
    if (REMOVE_NODES.test(key)) toRemove.push(o);
    else if (HIDE_NODES.test(key)) o.visible = false;
  });
  toRemove.forEach((o) => {
    o.traverse((c) => {
      if (!c.isMesh) return;
      c.geometry.dispose();
      [].concat(c.material).forEach((m) => m.dispose());
    });
    o.removeFromParent();
  });
  placeCurtain(model);
  paintWalls(model);
  fillKitchenFrame(model);
  addLoggiaPoster();
  fixWindows(model);
  model.traverse((o) => {
    if (!o.isMesh) return;
    [].concat(o.material).forEach((m) => { if (m && 'envMapIntensity' in m) m.envMapIntensity = ENV_INTENSITY; });
  });
  fixMirrors(model);
  model.updateMatrixWorld(true);

  // Габариты считаем только по полу и стенам
  const box = new THREE.Box3();
  model.traverse((o) => {
    if (o.isMesh && /^(Floor|Walls)$/.test(o.name)) box.expandByObject(o);
  });
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  console.log('Квартира (м):', size, 'Центр:', center, 'Мин:', box.min, 'Макс:', box.max);

  buildDefaults(box, size, center);
  addCeiling(box);
  addHallCove(box);
  addHeadboardGlow();

  // Одна и та же координата t у обеих кривых: i-я точка камеры соответствует i-й точке взгляда
  cameraCurve = new THREE.CatmullRomCurve3(CAMERA_POINTS.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  lookCurve   = new THREE.CatmullRomCurve3(LOOK_POINTS.map(p => new THREE.Vector3(...p)), false, 'centripetal');

  createHotspots();
  applyScroll(0);
  applyViewParam();   // ?view=… (после applyScroll, иначе стартовая точка маршрута перебьёт камеру)
}

/* Картина в рамке на кухне (узел «Pic-1», стена между кухней и комнатой, x −0.15, z −1.22…−0.58).
   В модели в ней стоит чужой рисунок; подставляем свою картинку. Она вписывается в поле рамки целиком (без растяжения,
   пропорции сохраняются), а свободное место вокруг заливается её же светлым фоном — получается паспарту. */
const KITCHEN_FRAME_IMAGE = 'textures/photo_2026-10-23_22-37-50.jpg';
const KITCHEN_FRAME_FIT = 0.94;         // какую долю поля занимает картинка (1 — вплотную, меньше — шире паспарту)
const KITCHEN_FRAME_BRIGHTNESS = 1.08;  // множитель цвета: меньше — темнее (чтобы белый фон не пересвечивался)

function fillKitchenFrame(model) {
  let picture = null;
  model.traverse((o) => { if (o.isMesh && o.name === 'picture' && o.parent && o.parent.name === 'Pic-1') picture = o; });
  if (!picture) { console.warn('Картина «Pic-1» не найдена — картинка в рамку не поставлена'); return; }

  // «Стекло» рамки — плоский квад без параметров материала (three.js делает его серым металлом) в миллиметре перед картиной:
  // анфас он закрывает рисунок серым. Прозрачным стеклом оно всё равно не было, поэтому скрываем.
  picture.parent.children.forEach((c) => { if (c.name === 'glass') c.visible = false; });

  // Размеры поля картины: самая тонкая сторона — толщина, остальные две — ширина и высота (в мировых координатах)
  picture.updateWorldMatrix(true, false);
  const size = new THREE.Box3().setFromObject(picture).getSize(new THREE.Vector3());
  const h = size.y, w = Math.max(size.x, size.z);
  const aspect = w / h;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round(512 / aspect);
  const g = canvas.getContext('2d');
  g.fillStyle = '#f8f8f8';
  g.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;                  // как у текстур glTF: v = 0 — верх картинки
  texture.anisotropy = 8;

  const img = new Image();
  img.onload = () => {
    try {   // фон паспарту берём из угла самой картинки, чтобы швов не было
      const probe = document.createElement('canvas');
      probe.width = probe.height = 1;
      const pg = probe.getContext('2d');
      pg.drawImage(img, 2, 2, 1, 1, 0, 0, 1, 1);
      const [r, gg, b] = pg.getImageData(0, 0, 1, 1).data;
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect(0, 0, canvas.width, canvas.height);
    } catch (e) { /* без доступа к пикселям остаётся #f8f8f8 */ }
    const k = Math.min(canvas.width / img.width, canvas.height / img.height) * KITCHEN_FRAME_FIT;
    const dw = img.width * k, dh = img.height * k;
    g.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    texture.needsUpdate = true;
  };
  img.src = KITCHEN_FRAME_IMAGE;

  const old = picture.material;
  picture.material = new THREE.MeshStandardMaterial({
    map: texture, color: new THREE.Color(KITCHEN_FRAME_BRIGHTNESS, KITCHEN_FRAME_BRIGHTNESS, KITCHEN_FRAME_BRIGHTNESS),
    roughness: 0.6, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,   // картина лежит в одной плоскости со стеклом и подложкой
  });
  [].concat(old).forEach((m) => m && m.dispose());
}

/* Постер на левой стене лоджии (если идти из кухни): западная стена x −3.1, свободный участок z −3.7…−2.5,
   бра висит на соседней, южной стене (x −2.45, z −2.47, y 1.74…1.95). Внешний размер 50 × 75 см — чуть больше 40 × 60,
   чтобы QR-код читался с маршрута камеры. Центр по высоте 1,5 м. */
const LOGGIA_POSTER = {
  image: 'textures/telegram_card.png',
  wallX: -3.1, centerY: 1.5, centerZ: -3.25,
  width: 0.50, height: 0.75,
  brightness: 0.62,   // множитель яркости карточки: меньше — темнее (белое не должно пересвечиваться)
};
function addLoggiaPoster() {
  const poster = buildPoster(LOGGIA_POSTER);
  poster.position.set(LOGGIA_POSTER.wallX, LOGGIA_POSTER.centerY, LOGGIA_POSTER.centerZ);
  poster.rotation.y = Math.PI / 2;   // лицом в лоджию (+x); вправо от зрителя — на север (−z)
  scene.add(poster);
}

let wallsMesh = null;   // нужен для проверки прямой видимости меток сквозь проёмы

/* Стены: меш «Walls» без материала → ставим матовый тёплый (иначе three.js делает его металлическим и тёмным). */
function paintWalls(model) {
  const wallMat = new THREE.MeshStandardMaterial({ color: WALL_COLOR, roughness: WALL_ROUGHNESS, metalness: 0 });
  let found = false;
  model.traverse((o) => {
    if (o.isMesh && o.name === 'Walls') { o.material = wallMat; wallsMesh = o; found = true; }
  });
  if (!found) console.warn('Меш Walls не найден — цвет стен не применён');
}

/* Зеркала. В модели у «Mirror.001/.002» металличность 1 при базовом цвете без карты окружения —
   они отражают тёмную пустоту и выглядят чёрными. Даём им светлый серебристо-голубоватый металл
   и отдельную яркую карту окружения (светлая комната с окном и лампами), чтобы было что отражать. */
function makeMirrorEnv() {
  const room = new THREE.Scene();
  const emissive = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.BackSide });
  const faces = [   // +x, -x, +y (потолок), -y (пол), +z, -z
    emissive(0xf3efe8, 1.0), emissive(0xece8e0, 1.0), emissive(0xffffff, 1.3),
    emissive(0xb9aa96, 0.8), emissive(0xf0ece4, 1.0), emissive(0xe8eef5, 1.1),
  ];
  room.add(new THREE.Mesh(new THREE.BoxGeometry(10, 5, 10), faces));
  const panel = (w, h, color, k, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; room.add(m);
    return m;
  };
  panel(3.2, 2.2, 0xcfe6ff, 4.0, 4.9, 0.3, -1, -Math.PI / 2);    // окно с дневным светом
  panel(2.4, 2.2, 0xdcecff, 3.0, -4.9, 0.3, 1.5, Math.PI / 2);
  panel(1.6, 1.6, 0xfff1da, 6.0, 0, 2.45, 0, 0).rotation.x = Math.PI / 2;   // потолочный светильник
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(room, 0.02).texture;
  pm.dispose();
  return tex;
}

function fixMirrors(model) {
  const mirrorEnv = makeMirrorEnv();
  const mirror = new THREE.MeshStandardMaterial({
    color: 0xdbe7f3, metalness: 1, roughness: 0.04,
    envMap: mirrorEnv, envMapIntensity: 1.25,
  });
  model.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => (/^Mirror\.\d+$/.test(m.name) ? mirror : m);
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
}

/* Окна. В модели у стекла «Glass» и рам «PVC»/«Plastic» нет параметров, и three.js делает их непрозрачным
   металлом: окно выглядит молочно-серой плитой, вида наружу нет. Заменяем: стекло — прозрачное,
   рама — матовый белый пластик. Только внутри узлов Window*: «PVC» ещё есть у стола, его не трогаем. */
function fixWindows(model) {
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xdcecf7, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16,
    envMapIntensity: 0.5, depthWrite: false, side: THREE.DoubleSide,
  });
  const frame = new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.55, metalness: 0 });
  const inWindow = (o) => { for (; o; o = o.parent) if (/^Window/.test(o.name)) return true; return false; };
  model.traverse((o) => {
    if (!o.isMesh || !inWindow(o)) return;
    const swap = (m) => (m.name === 'Glass' ? glass : (m.name === 'PVC' || m.name === 'Plastic') ? frame : m);
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
}

/* Потолок: в модели его нет, сверху видна пустота. Одна плоскость по габаритам стен на уровне их верха.
   Видна только снизу (FrontSide), так что в режиме отладки сверху она не мешает. */
function addCeiling(box) {
  const w = box.max.x - box.min.x;
  const d = box.max.z - box.min.z;
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({
      color: CEILING_COLOR, roughness: 1, metalness: 0,
      emissive: CEILING_COLOR, emissiveIntensity: CEILING_GLOW,
    }),
  );
  ceiling.name = 'Ceiling';
  ceiling.rotation.x = Math.PI / 2;                       // нормаль смотрит вниз, в комнаты
  ceiling.position.set((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
  scene.add(ceiling);
}

function placeCurtain(model) {
  let curtain = null;
  model.traverse((o) => {
    if (!curtain && o.name.replace(/[\s_.]/g, '') === CURTAIN.name) curtain = o;
  });
  if (!curtain) { console.warn('Штора не найдена в модели'); return; }

  const [sx, sy, sz] = CURTAIN.scale;
  curtain.rotation.set(Math.PI / 2, 0, 0);   // y' = −z (вниз), z' = y (от стены в комнату)
  curtain.scale.set(sx, sy, sz);
  curtain.position.set(
    CURTAIN.centerX - CURTAIN.local.centerX * sx,
    CURTAIN.topY + CURTAIN.local.topZ * sz,
    CURTAIN.wallZ,
  );

  // Подвижные части — ткань и тюль (карниз/кронштейны, материал «Black Metal», стоят на месте)
  const parts = [];
  curtain.traverse((o) => {
    if (!o.isMesh) return;
    const mat = [].concat(o.material).map(m => m.name).join(' ');
    if (/metal/i.test(mat)) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    parts.push(o);
  });

  // Каждый слой оставляем только левой половиной, а правую делаем её зеркальной копией
  // (в модели у правой половины стяжка с кисточкой и другая драпировка — шторки должны быть одинаковыми).
  // Левая собирается к левому краю окна, правая — к правому.
  const lo = Math.min(...parts.map(o => o.geometry.boundingBox.min.x));
  const hi = Math.max(...parts.map(o => o.geometry.boundingBox.max.x));
  const mid = (lo + hi) / 2;
  curtainParts = [];
  for (const mesh of parts) {
    mesh.geometry = leftHalfGeometry(mesh.geometry, mid);
    const rightMesh = new THREE.Mesh(mesh.geometry, mesh.material);   // та же геометрия, отражённая
    rightMesh.name = mesh.name + '_right';
    mesh.parent.add(rightMesh);
    curtainParts.push({ mesh, pivot: lo, mid: null }, { mesh: rightMesh, pivot: hi, mid });
  }
  applyCurtain(0);   // закрытая штора: правая половина встаёт зеркально слева от центра
}

/* Оставляет в геометрии только треугольники левее линии x = midX (по центру треугольника).
   Вершины общие, отличаются только индексы — памяти почти не тратится.
   Сетка шторы очень мелкая, поэтому край по центру получается ровным. */
function leftHalfGeometry(geo, midX) {
  const pos = geo.attributes.position;
  const idx = geo.index ? geo.index.array : null;
  const n = idx ? idx.length : pos.count;
  const left = [];
  for (let i = 0; i < n; i += 3) {
    const a = idx ? idx[i] : i, b = idx ? idx[i + 1] : i + 1, c = idx ? idx[i + 2] : i + 2;
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    if (cx < midX) left.push(a, b, c);
  }
  const g = new THREE.BufferGeometry();
  for (const key in geo.attributes) g.setAttribute(key, geo.attributes[key]);
  g.setIndex(new THREE.BufferAttribute(Uint32Array.from(left), 1));
  return g;
}

/* ---------- Открытие/закрытие шторы ---------- */
let curtainParts = [];
let curtainProgress = 0;   // 0 — закрыта, 1 — открыта
let curtainTarget = 0;

function setCurtainOpen(open) {
  curtainTarget = open ? 1 : 0;
}

/* ---------- Подсветки (LED-ленты со свечением на стене/потолке) ----------
   Общая логика для всех подсветок: у каждой есть объект { group, setLevel(0…1) } из decor.js, а здесь — плавное включение
   и выключение за GLOW_FADE секунд (smoothstep) и кнопка в карточке устройства. Чтобы добавить новую подсветку:
   создай её через buildXxx() из decor.js, вызови registerGlow(glow) и укажи в устройстве onToggle: (on) => setGlow(glow, on). */
const GLOW_FADE = 0.5;   // секунды на плавное включение/выключение
const glows = [];        // { glow, level, target }

function registerGlow(glow) {
  scene.add(glow.group);
  glows.push({ glow, level: 0, target: 0 });
  return glow;
}
function setGlow(glow, on) {
  const g = glows.find((x) => x.glow === glow);
  if (g) g.target = on ? 1 : 0;
}
function updateGlows(dt) {
  for (const g of glows) {
    if (g.level === g.target) continue;
    const step = dt / GLOW_FADE;
    g.level = g.target > g.level ? Math.min(g.target, g.level + step) : Math.max(g.target, g.level - step);
    g.glow.setLevel(g.level * g.level * (3 - 2 * g.level));   // smoothstep: мягкий старт и финиш
  }
}

/* Подсветка по периметру потолка коридора. Включается кнопкой в карточке умного выключателя у входной двери.
   Внутренние грани стен прихожей найдены лучами по модели (на высоте 2,3 м они ровные): x −1.089…1.279, z 1.386…2.961.
   Широких проёмов в кухню и комнату здесь нет — это двери 0.75–0.85 м, над ними стена до потолка, поэтому лента идёт
   по всему контуру и в соседние комнаты не заходит. */
const HALL_COVE = { x0: -1.089, x1: 1.279, z0: 1.386, z1: 2.961 };
let hallCove = null;
function addHallCove(box) { hallCove = registerGlow(buildCoveLight({ ...HALL_COVE, ceilingY: box.max.y })); }
function setHallCove(on) { setGlow(hallCove, on); }

/* Подсветка за изголовьем кровати. Включается кнопкой в карточке беспроводного выключателя на тумбочке.
   Изголовье (материал «back» в узле Modern Bed): панель у восточной стены, x 2.798…2.940, z −2.697…−0.108, верх y 1.121,
   верхние углы скруглены (r ≈ 0.08). Стена ровная, x = 2.945 (лучи по модели на высотах 0.6…1.3 м). */
const HEADBOARD_GLOW = { wallX: 2.945, zMin: -2.697, zMax: -0.108, yTop: 1.121, cornerR: 0.08 };
let headboardGlow = null;
function addHeadboardGlow() { headboardGlow = registerGlow(buildHeadboardGlow(HEADBOARD_GLOW)); }

function updateCurtain(dt) {
  if (!curtainParts.length || curtainProgress === curtainTarget) return;
  const diff = curtainTarget - curtainProgress;
  curtainProgress += Math.sign(diff) * Math.min(dt / CURTAIN.open.seconds, Math.abs(diff));
  applyCurtain(curtainProgress);
}

function applyCurtain(progress) {
  const k = progress * progress * (3 - 2 * progress);   // плавный старт и остановка
  const w = 1 + (CURTAIN.open.width - 1) * k;
  const d = 1 + (CURTAIN.open.depth - 1) * k;
  for (const { mesh, pivot, mid } of curtainParts) {
    mesh.scale.y = d;
    if (mid === null) {
      // левая половина: сжимаем относительно левого края
      mesh.scale.x = w;
      mesh.position.x = pivot * (1 - w);
    } else {
      // правая — зеркальная копия левой: x' = 2·mid − x, затем сжатие относительно правого края
      mesh.scale.x = -w;
      mesh.position.x = 2 * mid * w + pivot * (1 - w);
    }
  }
}

/* Заглушки: пока ты не задал свой маршрут, камера идёт по длинной стороне
   квартиры на уровне глаз, а метки раскиданы по этой же линии. */
function buildDefaults(box, size, center) {
  const floorY = box.min.y;
  const y = floorY + EYE_HEIGHT;
  const alongX = size.x >= size.z;

  if (!CAMERA_POINTS) {
    const a = alongX ? [box.min.x + 0.6, y, center.z] : [center.x, y, box.min.z + 0.6];
    const b = alongX ? [box.max.x - 0.6, y, center.z] : [center.x, y, box.max.z - 0.6];
    CAMERA_POINTS = [a, b];
    LOOK_POINTS = [
      alongX ? [a[0] + 2, y - 0.2, a[2]] : [a[0], y - 0.2, a[2] + 2],
      alongX ? [b[0] + 2, y - 0.2, b[2]] : [b[0], y - 0.2, b[2] + 2],
    ];
  }

  DEVICES.forEach((d, i) => {
    if (d.position) return;
    const t = (i + 1) / (DEVICES.length + 1);
    d.position = alongX
      ? [box.min.x + size.x * t, floorY + 1.2, center.z + 0.6]
      : [center.x + 0.6, floorY + 1.2, box.min.z + size.z * t];
  });
}

/* ---------- Метки устройств ---------- */
function createHotspots() {
  const wrap = document.getElementById('hotspots');
  DEVICES.forEach((d) => {
    const el = document.createElement('button');
    el.className = 'hotspot hidden';   // пока комната не определена — скрыта полностью (display: none)
    el.style.opacity = '0';
    el.textContent = d.icon;
    if (!ROOMS[d.room]) console.warn(`Устройство «${d.title}»: комната «${d.room}» не найдена в ROOMS`);
    const hs = {
      el, device: d, pos: new THREE.Vector3(...d.position),
      state: 'hidden',            // hidden → visible → fading → hidden
      roomRaw: false, roomOk: false, rawSince: 0, los: false, hideAt: 0, x: NaN, y: NaN,
    };
    // Скрытая или гаснущая метка не кликается, даже если событие пришло программно
    el.addEventListener('click', () => { if (hs.state === 'visible') openCard(d); });
    wrap.appendChild(el);
    hotspotEls.push(hs);

    if (d.model) {   // 3D-модель устройства: клик по ней открывает ту же карточку (см. обработчик кликов ниже)
      hs.model = d.model.build();
      hs.model.group.position.set(...d.model.position);
      hs.model.group.rotation.set(d.model.tiltX || 0, d.model.rotationY || 0, d.model.rollZ || 0, 'YXZ');   // сначала roll, затем наклон, затем поворот
      hs.model.group.userData.hotspot = hs;
      scene.add(hs.model.group);
      deviceModelGroups.push(hs.model.group);
    }

    // Источник света нужен только устройствам, которые правда светят. Каждая PointLight в сцене
    // (даже с intensity 0) считается в шейдере каждого материала на каждом пикселе.
    if (d.light) {
      const light = new THREE.PointLight(d.lightColor ?? 0xffd9a0, 0, 6);
      light.position.set(...d.position);
      scene.add(light);
      deviceLights.set(d.title, light);
    }
    deviceState.set(d.title, false);
  });
}

const card = document.getElementById('card');
const cardTitle = document.getElementById('card-title');
const cardText = document.getElementById('card-text');
const cardToggle = document.getElementById('card-toggle');
const cardBuy = document.getElementById('card-buy');

function openCard(d) {
  activeDevice = d;
  cardTitle.textContent = d.title;
  cardText.textContent = d.text;
  cardBuy.hidden = !d.buyUrl;                 // нет ссылки — нет и кнопки
  if (d.buyUrl) cardBuy.href = d.buyUrl;
  refreshCard();
  card.classList.remove('hidden');
}

function refreshCard() {
  const on = deviceState.get(activeDevice.title);
  cardToggle.textContent = on ? activeDevice.button[1] : activeDevice.button[0];
  cardToggle.classList.toggle('on', on);
}

cardToggle.addEventListener('click', () => {
  if (!activeDevice) return;
  const on = !deviceState.get(activeDevice.title);
  deviceState.set(activeDevice.title, on);
  if (activeDevice.light) deviceLights.get(activeDevice.title).intensity = on ? (activeDevice.lightIntensity ?? 30) : 0;
  if (activeDevice.onToggle) activeDevice.onToggle(on);
  const hs = hotspotEls.find(h => h.device === activeDevice);
  if (hs.model) hs.model.setOn(on);
  hs.el.classList.toggle('on', on);
  refreshCard();
});
document.getElementById('card-close').addEventListener('click', () => {
  card.classList.add('hidden');
  activeDevice = null;
});

/* ---------- Движение камеры по скроллу ---------- */
let targetT = 0;
let currentT = 0;
const hintEl = document.getElementById('hint');

function applyScroll(t) {
  if (!cameraCurve) return;
  const clamped = Math.min(Math.max(t, 0), 1);
  const u = cameraCurve.getUtoTmapping(clamped);   // равномерная скорость по длине пути камеры
  camera.position.copy(cameraCurve.getPoint(u));
  camera.lookAt(lookCurve.getPoint(u));
  // Поверх взгляда маршрута — поворот от мыши: влево/вправо вокруг вертикали мира, вверх/вниз вокруг оси камеры
  if (lookYaw !== 0 || lookPitch !== 0) {
    camera.quaternion.premultiply(qYaw.setFromAxisAngle(AXIS_Y, lookYaw));
    camera.quaternion.multiply(qPitch.setFromAxisAngle(AXIS_X, lookPitch));
  }
}

/* ---------- Обзор мышью ---------- */
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const qYaw = new THREE.Quaternion();
const qPitch = new THREE.Quaternion();
let lookYaw = 0;        // отклонение от взгляда маршрута, радианы (+ = влево)
let lookPitch = 0;      // (+ = вверх)
let lookReturning = false;
let dragging = false;
let dragLast = null;

window.addEventListener('pointerdown', (e) => {
  if (debugMode || e.pointerType !== 'mouse' || e.button !== 0) return;   // только мышь и левая кнопка
  if (e.target.closest('button, #card')) return;                          // метки и карточка устройств — как обычно
  dragging = true;
  lookReturning = false;                                                   // взяли управление — возврат отменяем
  dragLast = [e.clientX, e.clientY];
  canvas.style.cursor = 'grabbing';
  document.body.style.userSelect = 'none';                                 // не выделять текст, пока тянем
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - dragLast[0], dy = e.clientY - dragLast[1];
  dragLast = [e.clientX, e.clientY];
  // тянем «за сцену»: вправо — взгляд уходит влево, вниз — вверх
  lookYaw = Math.max(-Math.PI, Math.min(Math.PI, lookYaw + dx * LOOK_SENSITIVITY));
  lookPitch = Math.max(-LOOK_MAX_PITCH, Math.min(LOOK_MAX_PITCH, lookPitch + dy * LOOK_SENSITIVITY));
});
const endDrag = () => {
  if (!dragging) return;
  dragging = false;           // ракурс остаётся как есть
  canvas.style.cursor = '';
  document.body.style.userSelect = '';
};
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
window.addEventListener('blur', endDrag);

// Любая прокрутка (колесо, клавиши, полоса) возвращает взгляд на маршрут
function startLookReturn() {
  if (lookYaw !== 0 || lookPitch !== 0) lookReturning = true;
}
window.addEventListener('wheel', startLookReturn, { passive: true });

function updateLookReturn(dt) {
  if (!lookReturning || dragging) return;
  const f = 1 - Math.exp(-dt / LOOK_RETURN_TIME);
  lookYaw -= lookYaw * f;
  lookPitch -= lookPitch * f;
  if (Math.abs(lookYaw) < 1e-3 && Math.abs(lookPitch) < 1e-3) {
    lookYaw = 0;
    lookPitch = 0;
    lookReturning = false;
  }
}

window.addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  targetT = max > 0 ? window.scrollY / max : 0;
  if (window.scrollY > 40) hintEl.classList.add('hidden');
  if (!dragging) startLookReturn();
});

/* ---------- Отладка: D и P ---------- */
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyD') {
    debugMode = !debugMode;
    controls.enabled = debugMode;
    if (debugMode) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      controls.target.copy(camera.position).add(dir.multiplyScalar(2));
    }
    console.log(debugMode ? 'Режим отладки ВКЛ (мышь — вращать, P — координаты, O — имя объекта под курсором, H/U — скрыть/вернуть)' : 'Режим отладки ВЫКЛ');
  }
  if (e.code === 'KeyP' && debugMode) {
    const p = camera.position, t = controls.target;
    const f = (v) => `[${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}]`;
    console.log(`Камера: ${f(p)}   Смотрит в: ${f(t)}`);
  }
  if (debugMode && e.code === 'KeyO') pickObject();
  if (debugMode && e.code === 'KeyH' && pickedObject) {
    pickedObject.visible = false;
    console.log(`Скрыто: «${pickedObject.name}». Чтобы скрыть навсегда, добавь имя без точек/пробелов/«_» в HIDE_NODES: ${pickedObject.name.replace(/[\s_.]/g, '')}`);
    hiddenStack.push(pickedObject);
    pickedObject = null;
  }
  if (debugMode && e.code === 'KeyU' && hiddenStack.length) {
    const o = hiddenStack.pop(); o.visible = true;
    console.log(`Возвращено: «${o.name}»`);
  }
});

/* Пипетка: в режиме D наведи мышь на объект и нажми O (или просто кликни, см. ниже) —
   в консоли имя меша, материал и размеры.
   H — скрыть этот объект (проверить, он ли мешает), U — вернуть обратно. */
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let pickedObject = null;
const hiddenStack = [];
window.addEventListener('mousemove', (e) => {
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
});

/* ВРЕМЕННО: клик мышью по любому объекту сцены выводит его имя в консоль (F12).
   Когда найдёшь нужный объект — поставь CLICK_DEBUG = false или удали этот блок. */
const CLICK_DEBUG = true;
let downPos = null;
window.addEventListener('pointerdown', (e) => { downPos = [e.clientX, e.clientY]; });
window.addEventListener('click', (e) => {
  if (!CLICK_DEBUG) return;
  if (e.target.closest('button, #card')) return;                 // метки и карточка устройств — не трогаем
  if (downPos && Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 5) return;   // это было перетаскивание
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  pickObject();
});

/* Клик по 3D-модели устройства открывает ту же карточку, что и метка. Работает только пока метка видна
   (камера в той же комнате или устройство видно через проём) — сквозь стены кликнуть нельзя. */
const modelRay = new THREE.Raycaster();
const modelMouse = new THREE.Vector2();
window.addEventListener('click', (e) => {
  if (!deviceModelGroups.length || e.target.closest('button, #card')) return;
  if (downPos && Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]) > 5) return;   // перетаскивание
  modelMouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  modelRay.setFromCamera(modelMouse, camera);
  const hit = modelRay.intersectObjects(deviceModelGroups, true)[0];
  if (!hit) return;
  let g = hit.object;
  while (g && !g.userData.hotspot) g = g.parent;
  if (g && g.userData.hotspot.state === 'visible') openCard(g.userData.hotspot.device);
});

function isShown(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}
function pickObject() {
  if (!modelRoot) return;
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObject(modelRoot, true).find(h => h.object.isMesh && isShown(h.object));
  if (!hit) { console.log('Под курсором ничего нет'); return; }
  pickedObject = hit.object;
  const chain = [];
  for (let o = pickedObject; o && o !== modelRoot; o = o.parent) chain.push(o.userData.name || o.name || '(без имени)');
  const mat = [].concat(pickedObject.material).map(m => m.name).join(', ');
  const b = new THREE.Box3().setFromObject(pickedObject);
  const f = (v) => `[${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)}]`;
  console.log(
    `%cОБЪЕКТ: «${pickedObject.userData.name || pickedObject.name}»`, 'font-weight:bold;font-size:14px',
    `\nИмя в three.js: ${pickedObject.name}   Материал: ${mat}`,
    `\nЦепочка (от объекта к корню): ${chain.join(' ← ')}`,
    `\nГабариты (м): ${f(b.min)} … ${f(b.max)}   Расстояние от камеры: ${hit.distance.toFixed(2)} м`,
    `\nВ режиме D: H — скрыть объект, U — вернуть`,
  );
}

/* ---------- Комнаты и видимость меток ---------- */
const HOTSPOT_FADE_MS = 250;   // длительность затухания (должна совпадать с transition в style.css)
const losRay = new THREE.Raycaster();
const losDir = new THREE.Vector3();
let lastLosCheck = 0;

function roomAt(p) {
  for (const id in ROOMS) {
    const r = ROOMS[id];
    if (p.x >= r.x[0] && p.x < r.x[1] && p.z >= r.z[0] && p.z < r.z[1]) return id;
  }
  return null;
}

/* Метки чужих комнат, до которых от камеры нет стены на пути (открытый проём), считаем видимыми. */
function updateLineOfSight(camRoom) {
  const rangeSq = HOTSPOT_RANGE * HOTSPOT_RANGE;
  for (const hs of hotspotEls) {
    hs.los = false;
    if (!wallsMesh || hs.device.room === camRoom) continue;
    const dSq = camera.position.distanceToSquared(hs.pos);
    if (dSq >= rangeSq) continue;
    const dist = Math.sqrt(dSq);
    losDir.subVectors(hs.pos, camera.position).divideScalar(dist);
    losRay.set(camera.position, losDir);
    losRay.far = Math.max(dist - 0.1, 0);   // метка может висеть прямо у стены — саму стену за меткой не считаем
    hs.los = losRay.intersectObject(wallsMesh, false).length === 0;
  }
}

/* ---------- Главный цикл ---------- */
const tmp = new THREE.Vector3();
let lastFrameTime = performance.now();
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = Math.min((now - lastFrameTime) / 1000, 0.25);
  updateCurtain(dt);
  updateGlows(dt);
  updateLookReturn(dt);
  lastFrameTime = now;
  outdoors.update(camera);

  if (!debugMode) {
    currentT += (targetT - currentT) * SMOOTHING;
    applyScroll(currentT);
  } else {
    controls.update();
  }

  // Прикрепляем HTML-метки к точкам в 3D
  // В DOM пишем только то, что изменилось: лишние записи стиля и классов каждый кадр тормозят вёрстку.
  const camRoom = roomAt(camera.position);
  if (now - lastLosCheck >= HOTSPOT_LOS_INTERVAL) { lastLosCheck = now; updateLineOfSight(camRoom); }
  const w = window.innerWidth, h = window.innerHeight, rangeSq = HOTSPOT_RANGE * HOTSPOT_RANGE;
  for (const hs of hotspotEls) {
    const inView = camera.position.distanceToSquared(hs.pos) < rangeSq
      && tmp.copy(hs.pos).project(camera).z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;

    // Комната камеры или прямая видимость; смена должна продержаться HOTSPOT_ROOM_DELAY, иначе мигает на границе
    const raw = hs.device.room === camRoom || hs.los;
    if (raw !== hs.roomRaw) { hs.roomRaw = raw; hs.rawSince = now; }
    if (hs.roomRaw !== hs.roomOk && now - hs.rawSince >= HOTSPOT_ROOM_DELAY) hs.roomOk = hs.roomRaw;

    if (inView && hs.roomOk) {
      if (hs.state === 'hidden') {            // появление: из display:none → прозрачная → плавно непрозрачная
        hs.el.classList.remove('hidden');
        hs.el.style.opacity = '0';
        void hs.el.offsetWidth;
      }
      if (hs.state !== 'visible') { hs.state = 'visible'; hs.el.style.opacity = '1'; hs.el.style.pointerEvents = ''; }
    } else if (hs.state === 'visible' && inView) {   // ушли из комнаты: гаснет, кликов уже нет
      hs.state = 'fading';
      hs.hideAt = now + HOTSPOT_FADE_MS;
      hs.el.style.opacity = '0';
      hs.el.style.pointerEvents = 'none';
    } else if (hs.state !== 'hidden' && (!inView || (hs.state === 'fading' && now >= hs.hideAt))) {
      hs.state = 'hidden';                    // вне кадра или угасла — убираем из вёрстки совсем
      hs.el.classList.add('hidden');
      hs.el.style.opacity = '0';
      hs.el.style.pointerEvents = '';
    }
    if (hs.state === 'hidden' || !inView) continue;
    const x = Math.round((tmp.x * 0.5 + 0.5) * w), y = Math.round((-tmp.y * 0.5 + 0.5) * h);
    if (x !== hs.x || y !== hs.y) { hs.x = x; hs.y = y; hs.el.style.transform = `translate(${x}px, ${y}px)`; }
  }

  if (composer) composer.render();
  else renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});
