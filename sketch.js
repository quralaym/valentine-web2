// =====================
// НАСТРОЙКИ / ТЕКСТЫ
// =====================
const GREETING_TEXT = "Это специально игра созданная для вас персонально! Приятной игры!";
const FROM_ME_TEXT  = "Сообщение от меня: ты очень важный человек 💗";
const WISH_TEXT     = "Пусть у тебя будет много радости, тепла и улыбок ❤️";

const BG = [255, 240, 247];
const WALL = [255, 214, 229];
const TEXT = [120, 70, 95];
const HEART_MAIN = [255, 120, 170];
const HEART_LIGHT = [255, 175, 205];
const LETTER_EDGE = [160, 110, 135];

const DOOR_FILL = [255, 200, 230];
const DOOR_LOCK = [160, 110, 135];

// ВАЖНО: препятствия внутри уровня обозначены 'X'
// Дверь обозначена 'D' (закрыта пока не собраны все сердечки)
const LEVEL = [
  "#########################",
  "#....X....X.....X.......#",
  "#....####.....####..X...#",
  "#....#..#..X..#..#......#",
  "#..P.#..#.....#..#..D...#",
  "#....#..#..X..#..#......#",
  "#..X.####.....####..X...#",
  "#..........X..........X.#",
  "#########################",
];

let TILE = 40;         // базовый размер клетки (потом подстроим под экран)
let HUD_H = 70;

let canvasW = 0;
let canvasH = 0;

let state = "welcome"; // welcome | game | letter

let walls = new Set();     // '#'
let blocks = new Set();    // 'X' доп. препятствия
let doorPos = null;        // 'D'
let playerStart = null;

let hearts = new Set();    // рандомные сердечки
let collected = new Set();

let heartCount = 3;        // сколько сердечек собирать
let letterPos = null;      // письмо за дверью

let player = {x:0, y:0, runningUntil:0};
let startMillis = 0;

let stars = [];

let imgIdle, imgRun, imgChar2;

function preload(){
  // Положи рядом с index.html
  imgIdle  = loadImage("player.png");
  imgRun   = loadImage("player_run.png");
  imgChar2 = loadImage("char2.png");
}

function setup(){
  // адаптивный canvas по размеру окна
  computeLayout();
  const c = createCanvas(canvasW, canvasH);
  c.parent("game");

  textFont("Arial");
  stars = makeStars(120);

  parseLevel();
  newEntryStart(); // при каждом заходе в игру будет новый расклад

  // Экспортируем командный интерфейс для HTML-консоли
  window.gameCmd = (cmd) => handleConsoleCommand(cmd);
  logLine("Готово. Введите команду или нажмите ENTER/SPACE для старта.");
}

function windowResized(){
  computeLayout();
  resizeCanvas(canvasW, canvasH);
}

function computeLayout(){
  // Хотим, чтобы весь уровень помещался по ширине/высоте экрана
  const cols = LEVEL[0].length;
  const rows = LEVEL.length;

  const pad = 16;
  const maxW = windowWidth - pad;
  const maxH = windowHeight - pad - 180; // место под консоль снизу

  const tileByW = Math.floor(maxW / cols);
  const tileByH = Math.floor((maxH) / rows);

  TILE = constrain(Math.min(tileByW, tileByH), 26, 52);

  canvasW = cols * TILE;
  canvasH = rows * TILE + HUD_H;
}

function makeStars(n){
  let arr = [];
  for(let i=0;i<n;i++){
    arr.push({
      x: random(0, 1),
      y: random(0, 1),
      r: random([1,2]),
      phase: random(0, TWO_PI)
    });
  }
  return arr;
}

function parseLevel(){
  walls.clear?.();
  blocks.clear?.();
  walls = new Set();
  blocks = new Set();
  playerStart = null;
  doorPos = null;

  for(let y=0;y<LEVEL.length;y++){
    for(let x=0;x<LEVEL[0].length;x++){
      const ch = LEVEL[y][x];
      if(ch === "#") walls.add(`${x},${y}`);
      if(ch === "X") blocks.add(`${x},${y}`);
      if(ch === "P") playerStart = [x,y];
      if(ch === "D") doorPos = [x,y];
    }
  }

  if(!playerStart) throw new Error("Нет 'P' в уровне.");
  if(!doorPos) throw new Error("Нет 'D' в уровне.");

  // Письмо будет стоять "за дверью" (рядом справа от двери, если возможно)
  letterPos = [doorPos[0] + 1, doorPos[1]];
}

function newEntryStart(){
  // Новый вход: заново рандомим сердечки и сбрасываем прогресс
  collected = new Set();
  hearts = new Set();

  // Выбираем клетки для сердечек: не стены, не блоки, не дверь, не старт, не письмо
  const candidates = [];
  for(let y=0;y<LEVEL.length;y++){
    for(let x=0;x<LEVEL[0].length;x++){
      const key = `${x},${y}`;
      const isSolid = walls.has(key) || blocks.has(key);
      const isBad = (x===playerStart[0] && y===playerStart[1]) ||
                    (x===doorPos[0] && y===doorPos[1]) ||
                    (x===letterPos[0] && y===letterPos[1]);
      if(!isSolid && !isBad) candidates.push([x,y]);
    }
  }
  shuffle(candidates, true);
  for(let i=0;i<heartCount;i++){
    hearts.add(`${candidates[i][0]},${candidates[i][1]}`);
  }

  player.x = playerStart[0];
  player.y = playerStart[1];
  player.runningUntil = 0;

  startMillis = millis();
}

function logLine(msg){
  const el = document.getElementById("consoleLog");
  if(!el) return;
  const now = new Date();
  const t = now.toLocaleTimeString().slice(0, 8);
  el.textContent += `[${t}] ${msg}\n`;
  el.scrollTop = el.scrollHeight;
}

function isWall(x,y){
  return walls.has(`${x},${y}`);
}
function isBlock(x,y){
  return blocks.has(`${x},${y}`);
}
function doorClosed(){
  return collected.size < heartCount; // дверь закрыта пока не собраны все
}
function isDoor(x,y){
  return x===doorPos[0] && y===doorPos[1];
}

function canMoveTo(x,y){
  // границы
  if(x<0 || y<0 || x>=LEVEL[0].length || y>=LEVEL.length) return false;
  if(isWall(x,y) || isBlock(x,y)) return false;
  if(isDoor(x,y) && doorClosed()) return false; // закрытая дверь — препятствие
  return true;
}

function markMoved(){
  player.runningUntil = millis() + 220;
}

function tryMove(dx,dy){
  if(state !== "game") return;
  const nx = player.x + dx;
  const ny = player.y + dy;
  if(canMoveTo(nx,ny)){
    player.x = nx; player.y = ny;
    markMoved();

    const key = `${player.x},${player.y}`;
    if(hearts.has(key) && !collected.has(key)){
      collected.add(key);
      logLine(`Сердечко найдено! (${collected.size}/${heartCount})`);
      if(collected.size === heartCount){
        logLine("Все сердечки собраны! Дверь открылась ❤️");
      }
    }
  } else {
    logLine("Туда нельзя: препятствие/стена/закрытая дверь.");
  }
}

function handleConsoleCommand(cmdRaw){
  const cmd = cmdRaw.trim().toLowerCase();
  if(!cmd) return;

  logLine(`> ${cmdRaw}`);

  // команды меню
  if(cmd === "menu" || cmd === "r"){
    state = "welcome";
    logLine("Возврат в меню. Нажмите ENTER/SPACE, чтобы начать заново.");
    return;
  }

  if(state === "welcome"){
    if(cmd === "start" || cmd === "enter" || cmd === "space" || cmd === "go"){
      state = "game";
      newEntryStart();
      logLine("Игра началась. Собери сердечки, открой дверь и письмо.");
      return;
    }
    // подсказка
    logLine("Вы сейчас в меню. Команда: start");
    return;
  }

  if(state === "letter"){
    if(cmd === "menu" || cmd === "r"){
      state = "welcome";
      return;
    }
    logLine("Письмо уже открыто. Нажмите MENU/R чтобы вернуться.");
    return;
  }

  // open / e
  if(cmd === "open" || cmd === "e"){
    if(collected.size === heartCount &&
       player.x === letterPos[0] && player.y === letterPos[1]){
      state = "letter";
      logLine("Письмо открыто 💌");
    } else {
      logLine("Чтобы открыть: собери все сердечки и встань на клетку письма (за дверью).");
    }
    return;
  }

  // single-step movement
  const single = {
    "up": [0,-1], "w":[0,-1],
    "down":[0,1], "s":[0,1],
    "left":[-1,0], "a":[-1,0],
    "right":[1,0], "d":[1,0],
  };
  if(single[cmd]){
    const [dx,dy] = single[cmd];
    tryMove(dx,dy);
    return;
  }

  // go right 3
  // go <dir> <n>
  const parts = cmd.split(/\s+/);
  if(parts[0] === "go" && parts.length >= 3){
    const dir = parts[1];
    const n = parseInt(parts[2], 10);
    if(!Number.isFinite(n) || n <= 0 || n > 50){
      logLine("Пример: go right 3 (число 1..50)");
      return;
    }
    if(!single[dir]){
      logLine("Направления: up/down/left/right");
      return;
    }
    const [dx,dy] = single[dir];
    for(let i=0;i<n;i++){
      tryMove(dx,dy);
    }
    return;
  }

  logLine("Неизвестная команда. Примеры: up, go right 3, open, menu");
}

function keyPressed(){
  if(keyCode === ESCAPE) return;

  // старт из welcome
  if(state === "welcome"){
    if(keyCode === ENTER || key === " "){
      state = "game";
      newEntryStart();
      logLine("Игра началась. Собери сердечки, открой дверь и письмо.");
    }
    return;
  }

  if(key === "r" || key === "R"){
    state = "welcome";
    logLine("Возврат в меню. Нажмите ENTER/SPACE, чтобы начать заново.");
    return;
  }

  if(state !== "game") return;

  // движение
  if(keyCode === LEFT_ARROW || key === "a" || key === "A") tryMove(-1,0);
  if(keyCode === RIGHT_ARROW || key === "d" || key === "D") tryMove(1,0);
  if(keyCode === UP_ARROW || key === "w" || key === "W") tryMove(0,-1);
  if(keyCode === DOWN_ARROW || key === "s" || key === "S") tryMove(0,1);

  // открыть письмо
  if(key === "e" || key === "E"){
    handleConsoleCommand("open");
  }
}

function draw(){
  background(...BG);

  // мерцающие звёзды
  noStroke();
  for(let i=0;i<stars.length;i++){
    const sx = stars[i].x * width;
    const sy = stars[i].y * (height - HUD_H);
    const tw = 210 + 30 * sin((millis()*0.002) + stars[i].phase);
    fill(tw, tw-10, tw, 255);
    circle(sx, sy, stars[i].r);
  }

  if(state === "welcome"){
    drawWelcome();
    return;
  }

  drawLevel();
  drawHUD();

  if(state === "game"){
    drawHints();
  }

  if(state === "letter"){
    drawLetterOverlay();
  }
}

function drawWelcome(){
  fill(...TEXT);
  textSize(34);
  text("Добро пожаловать!", 20, 54);

  // Большой персонаж справа
  const cardX = width - 320;
  const cardY = 70;
  const cardW = 300;
  const cardH = 300;

  fill(255,245,250);
  stroke(...LETTER_EDGE);
  strokeWeight(2);
  rect(cardX, cardY, cardW, cardH, 22);
  noStroke();

  imageMode(CENTER);
  image(imgChar2, cardX + cardW/2, cardY + cardH/2, 250, 250);
  imageMode(CORNER);

  // пузырь слева
  const bubbleX = 20;
  const bubbleY = 90;
  const bubbleW = width - 360;
  const bubbleH = 240;

  fill(255,245,250);
  stroke(...LETTER_EDGE);
  strokeWeight(2);
  rect(bubbleX, bubbleY, bubbleW, bubbleH, 22);
  triangle(bubbleX + bubbleW - 30, bubbleY + bubbleH - 10,
           bubbleX + bubbleW - 10, bubbleY + bubbleH - 45,
           cardX + 40, cardY + 210);
  noStroke();

  fill(...TEXT);
  textSize(18);
  let y = bubbleY + 30;
  y = drawWrapped(GREETING_TEXT, bubbleX + 18, y, bubbleW - 36, 24);
  y += 10;
  drawWrapped(FROM_ME_TEXT, bubbleX + 18, y, bubbleW - 36, 24);

  fill(...TEXT);
  textSize(16);
  text("ENTER/SPACE — начать  |  или команда в консоли: start", 20, height - 22);
}

function drawWrapped(str, x, y, maxW, lineH){
  const words = str.split(" ");
  let cur = "";
  for(const w of words){
    const test = cur ? (cur + " " + w) : w;
    if(textWidth(test) <= maxW) cur = test;
    else {
      text(cur, x, y);
      y += lineH;
      cur = w;
    }
  }
  if(cur){
    text(cur, x, y);
    y += lineH;
  }
  return y;
}

function drawLevel(){
  const rows = LEVEL.length;
  const cols = LEVEL[0].length;

  // стены
  noStroke();
  for(const key of walls){
    const [x,y] = key.split(",").map(Number);
    fill(...WALL);
    rect(x*TILE, y*TILE, TILE, TILE, 12);
  }

  // блоки препятствий X
  for(const key of blocks){
    const [x,y] = key.split(",").map(Number);
    fill(255, 205, 225);
    rect(x*TILE+3, y*TILE+3, TILE-6, TILE-6, 10);
    fill(255, 185, 210);
    rect(x*TILE+7, y*TILE+7, TILE-14, TILE-14, 10);
  }

  // дверь
  const [dx,dy] = doorPos;
  const doorX = dx*TILE, doorY = dy*TILE;
  fill(...DOOR_FILL);
  rect(doorX+4, doorY+4, TILE-8, TILE-8, 12);
  stroke(...DOOR_LOCK);
  strokeWeight(2);
  if(doorClosed()){
    // замочек
    line(doorX + TILE/2, doorY + 10, doorX + TILE/2, doorY + TILE - 10);
    circle(doorX + TILE/2, doorY + TILE/2, 10);
  } else {
    // открыта — рисуем "проход"
    line(doorX + 10, doorY + 10, doorX + TILE - 10, doorY + TILE - 10);
    line(doorX + TILE - 10, doorY + 10, doorX + 10, doorY + TILE - 10);
  }
  noStroke();

  // сердечки
  for(const key of hearts){
    if(collected.has(key)) continue;
    const [x,y] = key.split(",").map(Number);
    drawHeart(x,y);
  }

  // письмо (за дверью) появляется, когда дверь открыта (все сердечки)
  if(!doorClosed()){
    drawLetter(letterPos[0], letterPos[1]);
  }

  // игрок
  drawPlayer();
}

function drawPlayer(){
  const running = millis() < player.runningUntil;
  const img = running ? imgRun : imgIdle;

  const cx = player.x*TILE + TILE/2;
  const cy = player.y*TILE + TILE/2;

  // тень
  fill(0,0,0,40);
  ellipse(cx, cy + TILE*0.35, TILE*0.7, TILE*0.22);

  // персонаж больше клетки
  const size = TILE * 1.55;
  imageMode(CENTER);
  image(img, cx, cy, size, size);
  imageMode(CORNER);
}

function drawHeart(gx,gy){
  const px = gx*TILE + TILE/2;
  const py = gy*TILE + TILE/2;
  const pulse = 1 + 0.08 * sin(millis()*0.006);
  const size = (TILE-12)*pulse;

  const x = px - size/2;
  const y = py - size/2;

  noStroke();
  fill(...HEART_MAIN);
  circle(x+size*0.25, y+size*0.25, size*0.5);
  circle(x+size*0.75, y+size*0.25, size*0.5);
  rect(x, y+size*0.25, size, size*0.75, 14);

  fill(...HEART_LIGHT);
  rect(x+4, y+size*0.5, size-8, size*0.5, 14);
}

function drawLetter(gx,gy){
  const px = gx*TILE, py = gy*TILE;
  fill(255,230,240);
  stroke(...LETTER_EDGE);
  strokeWeight(2);
  rect(px+6, py+10, TILE-12, TILE-20, 12);
  noFill();
  triangle(px+8, py+14, px+TILE/2, py+TILE/2, px+TILE-8, py+14);
  noStroke();
}

function drawHUD(){
  const hudY = LEVEL.length*TILE;
  fill(255,245,250);
  rect(0, hudY, width, HUD_H);
  stroke(...LETTER_EDGE);
  strokeWeight(2);
  line(0, hudY, width, hudY);
  noStroke();

  fill(...TEXT);
  textSize(18);
  const elapsed = ((millis()-startMillis)/1000).toFixed(1);
  text(`Собрано: ${collected.size}/${heartCount}`, 12, hudY+28);
  text(`Время: ${elapsed}с`, 190, hudY+28);

  let hint = doorClosed()
    ? "Собери все сердечки, чтобы открыть дверь"
    : "Дверь открыта — иди к письму и нажми E/OPEN";
  text(hint, 330, hudY+28);
}

function drawHints(){
  fill(...TEXT);
  textSize(18);
  if(doorClosed()){
    text("Цель: собери сердечки → дверь откроется → дойди до письма", 12, 22);
  } else {
    text("Дверь открыта! Подойди к письму (за дверью) и нажми E/OPEN", 12, 22);
  }
}

function drawLetterOverlay(){
  fill(255,220,235,210);
  rect(0,0,width,height);

  fill(...TEXT);
  textSize(34);
  text("Для тебя 💌", width/2-90, 120);

  const boxX = 60, boxY = 160, boxW = width-120, boxH = 190;
  fill(255,245,250);
  stroke(...LETTER_EDGE);
  strokeWeight(2);
  rect(boxX, boxY, boxW, boxH, 18);
  noStroke();

  fill(...TEXT);
  textSize(18);
  let y = boxY + 34;
  y = drawWrapped(WISH_TEXT, boxX + 18, y, boxW - 36, 26);

  textSize(16);
  text("Команда: menu  |  или клавиша R", boxX + 18, boxY + boxH - 18);
}
