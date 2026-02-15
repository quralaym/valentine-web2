// =====================
// НАСТРОЙКИ
// =====================
const TILE = 40;
const HUD_H = 70;

const GREETING_TEXT = "Это специально игра созданная для вас персонально! Приятной игры!";
const FROM_ME_TEXT  = "Сообщение от меня: ты очень важный человек 💗";
const WISH_TEXT     = "Пусть у тебя будет много радости, тепла и улыбок ❤️";

// Пастельная палитра
const BG = [255, 240, 247];
const WALL = [255, 214, 229];
const TEXT = [120, 70, 95];
const HEART_MAIN = [255, 120, 170];
const HEART_LIGHT = [255, 175, 205];
const LETTER_EDGE = [160, 110, 135];

const CLOUD_FILL = [245, 235, 245];
const CLOUD_EDGE = [210, 190, 210];

// Карта: # стены, P старт. Сердечки будем ставить случайно (не храним в карте).
const LEVEL = [
  "#########################",
  "#.......................#",
  "#....####.....####......#",
  "#....#..#.....#..#......#",
  "#..P.#..#.....#..#......#",
  "#....#..#.....#..#......#",
  "#....####.....####......#",
  "#.......................#",
  "#########################",
];

const GRID_W = LEVEL[0].length;
const GRID_H = LEVEL.length;

const W = GRID_W * TILE;
const H = GRID_H * TILE + HUD_H;

// Картинки
let imgIdle, imgRun, imgChar2;

// Состояния
let state = "welcome"; // welcome | game | letter

// Уровень
let walls = new Set();
let emptyCells = [];
let playerStart = null;

// Игровые объекты
let hearts = new Set();       // set "x,y"
let collected = new Set();    // set "x,y"
let heartCount = 3;

let player = { x: 0, y: 0, runningUntil: 0 };
let letterPos = [GRID_W - 3, GRID_H - 2];

let obstacles = []; // движущиеся препятствия
let startMillis = 0;

// Звёздочки
let stars = [];

// =====================
// ЗАГРУЗКА
// =====================
function preload() {
  // Файлы должны лежать рядом с index.html
  imgIdle  = loadImage("player.png");
  imgRun   = loadImage("player_run.png");
  imgChar2 = loadImage("char2.png");
}

function setup() {
  createCanvas(W, H);
  textFont("Arial");

  parseLevel();

  // подготовим звёзды
  for (let i = 0; i < 140; i++) {
    stars.push({
      x: random(0, width),
      y: random(0, height - HUD_H),
      r: random([1, 2]),
      k: i
    });
  }
}

// =====================
// ПАРС КАРТЫ
// =====================
function parseLevel() {
  walls = new Set();
  emptyCells = [];
  playerStart = null;

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const ch = LEVEL[y][x];
      if (ch === "#") walls.add(keyOf(x, y));
      else emptyCells.push([x, y]);

      if (ch === "P") playerStart = [x, y];
    }
  }

  if (!playerStart) {
    playerStart = [1, 1]; // запасной вариант
  }
}

function keyOf(x, y) {
  return `${x},${y}`;
}

function isWall(x, y) {
  return walls.has(keyOf(x, y));
}

function inBounds(x, y) {
  return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
}

// =====================
// НОВЫЙ ВХОД / НОВАЯ ПОПЫТКА
// =====================
function newEntryStart() {
  // сердечки — заново
  collected = new Set();
  hearts = new Set();

  const candidates = emptyCells.filter(([x, y]) => !(x === playerStart[0] && y === playerStart[1]));
  shuffle(candidates, true);

  for (let i = 0; i < heartCount; i++) {
    hearts.add(keyOf(candidates[i][0], candidates[i][1]));
  }

  // игрок — на старт
  player.x = playerStart[0];
  player.y = playerStart[1];
  player.runningUntil = 0;

  // препятствия — заново (чтобы каждый раз маршрут менялся)
  obstacles = makeObstacles();

  startMillis = millis();
}

function makeObstacles() {
  // Два патруля с разной логикой и скоростью.
  // Они двигаются по линии, отражаются и НЕ проходят сквозь стены.
  // Подбираем траектории так, чтобы было интересно на твоей карте.

  return [
    // горизонтальный патруль
    {
      x: 10, y: 2,
      dir: 1,
      axis: "x",
      min: 6, max: 18,
      speed: 2.0,     // клетки в секунду (на самом деле скорость в "клетках", с dt)
      fx: 10.0        // float позиция
    },
    // вертикальный патруль
    {
      x: 18, y: 6,
      dir: -1,
      axis: "y",
      min: 2, max: 7,
      speed: 1.6,
      fy: 6.0
    },
    // третий маленький “быстрый” патруль
    {
      x: 4, y: 7,
      dir: 1,
      axis: "x",
      min: 2, max: 9,
      speed: 2.6,
      fx: 4.0
    }
  ];
}

// =====================
// РИСОВАНИЕ
// =====================
function draw() {
  background(...BG);

  drawStars();

  if (state === "welcome") {
    drawWelcome();
    return;
  }

  // обновление препятствий
  if (state === "game") {
    updateObstacles(deltaTime / 1000.0);
    handleCollectAndHit();
  }

  drawLevel();

  drawHUD();

  if (state === "letter") {
    drawLetterOverlay();
  }
}

function drawStars() {
  noStroke();
  for (const s of stars) {
    const tw = 210 + 30 * sin((millis() * 0.002) + s.k);
    fill(tw, tw - 10, tw, 255);
    circle(s.x, s.y, s.r);
  }
}

function drawLevel() {
  // стены
  noStroke();
  fill(...WALL);
  for (const k of walls) {
    const [x, y] = k.split(",").map(Number);
    rect(x * TILE, y * TILE, TILE, TILE, 12);
  }

  // сердечки
  for (const k of hearts) {
    if (collected.has(k)) continue;
    const [x, y] = k.split(",").map(Number);
    drawHeart(x, y);
  }

  // препятствия
  for (const o of obstacles) {
    drawCloud(o);
  }

  // письмо появляется, когда всё собрано
  if (collected.size === heartCount) {
    drawLetter(letterPos[0], letterPos[1]);
    // подсказка
    fill(...TEXT);
    textSize(26);
    text("Ты собрал(а) все сердечки 💗", 14, 38);
    textSize(18);
    text("Подойди к письму и нажми E, чтобы открыть", 14, 68);
  }

  // игрок
  drawPlayer();
}

function drawPlayer() {
  const px = player.x * TILE + TILE / 2;
  const py = player.y * TILE + TILE / 2;

  // тень
  noStroke();
  fill(0, 0, 0, 40);
  ellipse(px, py + TILE * 0.35, TILE * 0.75, TILE * 0.22);

  // спрайт больше клетки
  const size = TILE * 1.55;
  const running = millis() < player.runningUntil;
  const img = running ? imgRun : imgIdle;

  imageMode(CENTER);
  image(img, px, py, size, size);
  imageMode(CORNER);
}

function drawHeart(gx, gy) {
  const px = gx * TILE + TILE / 2;
  const py = gy * TILE + TILE / 2;

  const pulse = 1 + 0.08 * sin(millis() * 0.006);
  const size = (TILE - 12) * pulse;

  const x = px - size / 2;
  const y = py - size / 2;

  noStroke();
  fill(...HEART_MAIN);
  circle(x + size * 0.25, y + size * 0.25, size * 0.5);
  circle(x + size * 0.75, y + size * 0.25, size * 0.5);
  rect(x, y + size * 0.25, size, size * 0.75, 14);

  fill(...HEART_LIGHT);
  rect(x + 4, y + size * 0.5, size - 8, size * 0.5, 14);
}

function drawLetter(gx, gy) {
  const px = gx * TILE;
  const py = gy * TILE;

  stroke(...LETTER_EDGE);
  strokeWeight(2);
  fill(255, 230, 240);
  rect(px + 6, py + 10, TILE - 12, TILE - 20, 12);

  noFill();
  triangle(px + 8, py + 14, px + TILE / 2, py + TILE / 2, px + TILE - 8, py + 14);

  noStroke();
}

function drawCloud(o) {
  const px = o.x * TILE;
  const py = o.y * TILE;

  const wobble = 2 * sin(millis() * 0.004 + (o.x + o.y));

  noStroke();
  fill(...CLOUD_FILL);
  circle(px + 14, py + 18 + wobble, 24);
  circle(px + 28, py + 16 + wobble, 28);
  circle(px + 44, py + 20 + wobble, 22);

  noFill();
  stroke(...CLOUD_EDGE);
  strokeWeight(2);
  circle(px + 28, py + 16 + wobble, 28);
  noStroke();
}

function drawHUD() {
  const hudY = GRID_H * TILE;

  noStroke();
  fill(255, 245, 250);
  rect(0, hudY, width, HUD_H);

  stroke(...LETTER_EDGE);
  strokeWeight(2);
  line(0, hudY, width, hudY);
  noStroke();

  fill(...TEXT);
  textSize(18);

  const elapsed = ((millis() - startMillis) / 1000).toFixed(1);
  text(`Собрано: ${collected.size}/${heartCount}`, 14, hudY + 28);
  text(`Время: ${elapsed}с`, 210, hudY + 28);
  text(`WASD/стрелки • E — письмо • R — в меню`, 370, hudY + 28);

  textSize(14);
  text(`Если коснёшься облачка — попытка сбросится и сердечки переставятся`, 14, hudY + 52);
}

// =====================
// ПРИВЕТСТВИЕ
// =====================
function drawWelcome() {
  // заголовок
  fill(...TEXT);
  textSize(34);
  text("Добро пожаловать!", 40, 70);

  // справа большая карточка с персонажем 2
  const cardX = width - 320, cardY = 90, cardW = 280, cardH = 280;
  stroke(...LETTER_EDGE);
  strokeWeight(2);
  fill(255, 245, 250);
  rect(cardX, cardY, cardW, cardH, 22);
  noStroke();

  // персонаж 2 большой
  imageMode(CENTER);
  image(imgChar2, cardX + cardW / 2, cardY + cardH / 2, 240, 240);
  imageMode(CORNER);

  // пузырь слева
  const bX = 40, bY = 110, bW = width - 400, bH = 240;
  stroke(...LETTER_EDGE);
  strokeWeight(2);
  fill(255, 245, 250);
  rect(bX, bY, bW, bH, 22);

  // хвост пузыря
  triangle(bX + bW - 40, bY + bH - 10, bX + bW - 10, bY + bH - 40, cardX + 40, cardY + 210);
  noStroke();

  fill(...TEXT);
  textSize(18);

  let y = bY + 35;
  for (const line of wrapForP5(GREETING_TEXT, bW - 40)) {
    text(line, bX + 20, y);
    y += 26;
  }
  y += 12;
  for (const line of wrapForP5(FROM_ME_TEXT, bW - 40)) {
    text(line, bX + 20, y);
    y += 26;
  }

  textSize(18);
  text("ENTER или SPACE — начать игру", 40, height - 48);
  textSize(16);
  text("Каждый запуск — новый расклад сердечек и новый маршрут", 40, height - 22);
}

function wrapForP5(txt, maxW) {
  const words = txt.split(" ");
  let lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? (cur + " " + w) : w;
    if (textWidth(test) <= maxW) cur = test;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// =====================
// ПРЕПЯТСТВИЯ: ДВИЖЕНИЕ + СТОЛКНОВЕНИЯ
// =====================
function updateObstacles(dt) {
  // dt в секундах
  for (const o of obstacles) {
    if (o.axis === "x") {
      o.fx = (o.fx ?? o.x);
      o.fx += o.dir * o.speed * dt;
      // границы
      if (o.fx < o.min) { o.fx = o.min; o.dir = 1; }
      if (o.fx > o.max) { o.fx = o.max; o.dir = -1; }

      // проверка стены в целевой клетке (чтобы не проходило сквозь стены)
      const nx = Math.round(o.fx);
      if (isWall(nx, o.y)) {
        // разворот и небольшой откат
        o.dir *= -1;
        o.fx += o.dir * 0.25;
      }
      o.x = Math.round(o.fx);
    } else {
      o.fy = (o.fy ?? o.y);
      o.fy += o.dir * o.speed * dt;
      if (o.fy < o.min) { o.fy = o.min; o.dir = 1; }
      if (o.fy > o.max) { o.fy = o.max; o.dir = -1; }

      const ny = Math.round(o.fy);
      if (isWall(o.x, ny)) {
        o.dir *= -1;
        o.fy += o.dir * 0.25;
      }
      o.y = Math.round(o.fy);
    }
  }
}

function handleCollectAndHit() {
  // сбор
  const pk = keyOf(player.x, player.y);
  if (hearts.has(pk)) collected.add(pk);

  // столкновение с препятствием
  for (const o of obstacles) {
    if (o.x === player.x && o.y === player.y) {
      // Сброс: новая расстановка (как ты просила)
      newEntryStart();
      break;
    }
  }
}

// =====================
// ПИСЬМО/ОКНО
// =====================
function drawLetterOverlay() {
  noStroke();
  fill(255, 220, 235, 210);
  rect(0, 0, width, height);

  fill(...TEXT);
  textSize(34);
  text("Для тебя 💌", width / 2 - 90, 120);

  const boxX = 110, boxY = 160, boxW = width - 220, boxH = 170;
  fill(255, 245, 250);
  stroke(...LETTER_EDGE);
  strokeWeight(2);
  rect(boxX, boxY, boxW, boxH, 18);
  noStroke();

  fill(...TEXT);
  textSize(18);

  const lines = wrapForP5(WISH_TEXT, boxW - 40);
  let y = boxY + 32;
  for (const line of lines.slice(0, 6)) {
    text(line, boxX + 20, y);
    y += 26;
  }

  textSize(16);
  text("Нажми R, чтобы вернуться в меню", width / 2 - 160, 365);
}

// =====================
// УПРАВЛЕНИЕ
// =====================
function keyPressed() {
  if (state === "welcome") {
    if (keyCode === ENTER || key === " ") {
      state = "game";
      newEntryStart(); // новый вход = новая расстановка
    }
    return;
  }

  // R: в меню
  if (key === "r" || key === "R") {
    state = "welcome";
    return;
  }

  if (state === "letter") return;

  // движение
  let dx = 0, dy = 0;
  if (keyCode === LEFT_ARROW || key === "a" || key === "A") dx = -1;
  if (keyCode === RIGHT_ARROW || key === "d" || key === "D") dx = 1;
  if (keyCode === UP_ARROW || key === "w" || key === "W") dy = -1;
  if (keyCode === DOWN_ARROW || key === "s" || key === "S") dy = 1;

  if (dx || dy) {
    const nx = player.x + dx;
    const ny = player.y + dy;
    if (inBounds(nx, ny) && !isWall(nx, ny)) {
      player.x = nx;
      player.y = ny;
      player.runningUntil = millis() + 220; // бегущий спрайт чуть после шага
    }
  }

  // открыть письмо
  if ((key === "e" || key === "E") && collected.size === heartCount) {
    if (player.x === letterPos[0] && player.y === letterPos[1]) {
      state = "letter";
    }
  }
}
