// =====================
// НАСТРОЙКИ
// =====================
const TILE = 40;
const HUD_H = 70;

const GREETING_TEXT = "Это специально игра созданная для вас персонально! Приятной игры!";
const FROM_ME_TEXT = "Сообщение от меня: ты очень важный человек 💗";
const WISH_TEXT = "Пусть у тебя будет много радости, тепла и улыбок ❤️";

const BG = [255, 240, 247];
const WALL = [255, 214, 229];
const TEXT = [120, 70, 95];
const HEART_MAIN = [255, 120, 170];
const HEART_LIGHT = [255, 175, 205];
const LETTER_EDGE = [160, 110, 135];

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

const W = LEVEL[0].length * TILE;
const H = LEVEL.length * TILE + HUD_H;

let state = "welcome"; // welcome | game | letter

let walls = new Set();
let emptyCells = [];
let playerStart = null;

let hearts = new Set();
let collected = new Set();
let heartCount = 3;

let player = {x:0, y:0, runningUntil:0};

let letterPos = null;
let startMillis = 0;

// Картинки
let imgIdle, imgRun, imgChar2;

function preload(){
  // Положи эти файлы рядом с index.html
  imgIdle = loadImage("player.png");
  imgRun  = loadImage("player_run.png");
  imgChar2 = loadImage("char2.png");
}

function setup(){
  createCanvas(W, H);
  textFont("Arial");
  parseLevel();
  resetNewEntry(); // чтобы при старте уже было "по-новому"
}

function parseLevel(){
  walls.clear?.();
  walls = new Set();
  emptyCells = [];
  playerStart = null;

  for(let y=0;y<LEVEL.length;y++){
    for(let x=0;x<LEVEL[0].length;x++){
      const ch = LEVEL[y][x];
      if(ch === "#") walls.add(`${x},${y}`);
      else emptyCells.push([x,y]);
      if(ch === "P") playerStart = [x,y];
    }
  }
}

function resetNewEntry(){
  // Каждый новый вход: рандомим сердечки и сбрасываем прогресс
  collected = new Set();
  hearts = new Set();
  const cells = emptyCells.filter(c => !(c[0]===playerStart[0] && c[1]===playerStart[1]));
  shuffle(cells, true);
  for(let i=0;i<heartCount;i++){
    hearts.add(`${cells[i][0]},${cells[i][1]}`);
  }

  player.x = playerStart[0];
  player.y = playerStart[1];
  player.runningUntil = 0;

  // письмо справа внизу (внутри)
  letterPos = [LEVEL[0].length - 3, LEVEL.length - 2];

  startMillis = millis();
}

function isWall(x,y){
  return walls.has(`${x},${y}`);
}

function markMoved(){
  player.runningUntil = millis() + 220;
}

function draw(){
  background(...BG);

  // фоновые точки
  noStroke();
  for(let i=0;i<120;i++){
    const sx = (i*53) % width;
    const sy = (i*97) % (height-HUD_H);
    const tw = 210 + 30 * sin((millis()*0.002) + i);
    fill(tw, tw-10, tw, 255);
    circle(sx, sy, (i%2)+1);
  }

  if(state === "welcome"){
    drawWelcome();
    return;
  }

  drawLevel();

  if(state === "game"){
    drawHUD();
    checkWin();
  }

  if(state === "letter"){
    drawHUD();
    drawLetterOverlay();
  }
}

function drawLevel(){
  // стены
  for(const key of walls){
    const [x,y] = key.split(",").map(Number);
    const px = x*TILE, py = y*TILE;
    fill(...WALL);
    rect(px, py, TILE, TILE, 12);
  }

  // сердечки
  for(const key of hearts){
    if(collected.has(key)) continue;
    const [x,y] = key.split(",").map(Number);
    drawHeart(x,y);
  }

  // письмо если собрано всё
  if(collected.size === heartCount){
    drawLetter(letterPos[0], letterPos[1]);
  }

  // игрок
  drawPlayer();
}

function drawPlayer(){
  const px = player.x*TILE + TILE/2;
  const py = player.y*TILE + TILE/2;

  // тень
  fill(0,0,0,40);
  ellipse(px, py + TILE*0.35, TILE*0.7, TILE*0.22);

  const running = millis() < player.runningUntil;
  const img = running ? imgRun : imgIdle;

  // крупнее клетки
  const size = TILE*1.55;
  imageMode(CENTER);
  image(img, px, py, size, size);
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
  text(`Собрано: ${collected.size}/${heartCount}`, 14, hudY+28);
  text(`Время: ${elapsed}с`, 200, hudY+28);
  text(`WASD/стрелки • E — письмо • R — в меню`, 340, hudY+28);
}

function checkWin(){
  // сбор сердечек
  const key = `${player.x},${player.y}`;
  if(hearts.has(key)) collected.add(key);

  // открыть письмо
  if(collected.size === heartCount){
    // подсказка
    fill(...TEXT);
    textSize(28);
    text("Ты собрал(а) все сердечки 💗", 14, 40);
    textSize(18);
    text("Подойди к письму и нажми E, чтобы открыть", 14, 70);
  }
}

function drawLetterOverlay(){
  fill(255,220,235,210);
  rect(0,0,width,height);

  fill(...TEXT);
  textSize(34);
  text("Для тебя 💌", width/2-90, 120);

  const boxX = 110, boxY = 160, boxW = width-220, boxH = 170;
  fill(255,245,250);
  stroke(...LETTER_EDGE);
  strokeWeight(2);
  rect(boxX, boxY, boxW, boxH, 18);
  noStroke();

  fill(...TEXT);
  textSize(18);
  const lines = wrapForP5(WISH_TEXT, boxW-40);
  let y = boxY + 32;
  for(const line of lines.slice(0,6)){
    text(line, boxX+20, y);
    y += 26;
  }

  text("Нажми R, чтобы вернуться в главное меню", width/2-220, 365);
}

function drawWelcome(){
  // большой персонаж справа
  fill(255,245,250);
  stroke(...LETTER_EDGE);
  strokeWeight(2);
  rect(width-320, 90, 280, 280, 22);
  noStroke();

  imageMode(CENTER);
  image(imgChar2, width-180, 230, 240, 240);
  imageMode(CORNER);

  // пузырь
  fill(255,245,250);
  stroke(...LETTER_EDGE);
  strokeWeight(2);
  rect(40, 110, width-400, 240, 22);
  // хвост
  triangle(width-360, 320, width-330, 280, width-250, 300);
  noStroke();

  fill(...TEXT);
  textSize(34);
  text("Добро пожаловать!", 40, 70);

  textSize(18);
  let y = 145;
  for(const line of wrapForP5(GREETING_TEXT, width-440)){
    text(line, 60, y); y += 26;
  }
  y += 10;
  for(const line of wrapForP5(FROM_ME_TEXT, width-440)){
    text(line, 60, y); y += 26;
  }

  text("ENTER или SPACE — начать игру", 40, height-48);
  text("ESC — выход", 40, height-22);
}

function wrapForP5(txt, maxW){
  const words = txt.split(" ");
  let lines = [];
  let cur = "";
  for(const w of words){
    const test = cur ? (cur + " " + w) : w;
    if(textWidth(test) <= maxW) cur = test;
    else { if(cur) lines.push(cur); cur = w; }
  }
  if(cur) lines.push(cur);
  return lines;
}

function keyPressed(){
  if(keyCode === ESCAPE){
    // браузер не всегда даёт закрыть вкладку, просто ничего
    return;
  }

  if(state === "welcome"){
    if(keyCode === ENTER || key === " "){
      state = "game";
      resetNewEntry(); // новый вход = новая расстановка
    }
    return;
  }

  if(key === "r" || key === "R"){
    // R = вернуться в меню, и при следующем старте будет новый расклад
    state = "welcome";
    return;
  }

  if(state === "letter"){
    return;
  }

  // Движение
  let dx=0, dy=0;
  if(keyCode === LEFT_ARROW || key === "a" || key === "A") dx = -1;
  if(keyCode === RIGHT_ARROW || key === "d" || key === "D") dx = 1;
  if(keyCode === UP_ARROW || key === "w" || key === "W") dy = -1;
  if(keyCode === DOWN_ARROW || key === "s" || key === "S") dy = 1;

  if(dx || dy){
    const nx = player.x + dx;
    const ny = player.y + dy;
    if(!isWall(nx,ny)){
      player.x = nx; player.y = ny;
      markMoved();
    }
  }

  // Открыть письмо
  if((key === "e" || key === "E") && collected.size === heartCount){
    if(player.x === letterPos[0] && player.y === letterPos[1]){
      state = "letter";
    }
  }
}
