// 数字合成 - 微信小游戏
console.log('[GAME] Starting...');

try {
  var canvas = wx.createCanvas();
  console.log('[GAME] Canvas created:', canvas.width, 'x', canvas.height);
} catch(e) {
  console.error('[GAME] wx.createCanvas failed:', e);
}

var ctx = null;
try {
  ctx = canvas.getContext('2d');
  console.log('[GAME] 2D context obtained');
} catch(e) {
  console.error('[GAME] getContext failed:', e);
}

var sysInfo = wx.getSystemInfoSync();
var W = sysInfo.windowWidth;
var H = sysInfo.windowHeight;
console.log('[GAME] Screen:', W, 'x', H);

ctx.fillStyle = '#faf8ef';
ctx.fillRect(0, 0, W, H);
console.log('[GAME] Background filled');

// ========================
// CONSTANTS
// ========================
var ROWS = 11;
var COLS = 6;
var CELL_W = 110;
var CELL_H = 90;
var GAP = 6;
var ROW_H = CELL_H + GAP;
var DESIGN_W = 750;
var SCALE = W / DESIGN_W;

var SPAWN_VALUES = [2, 4, 8, 16, 32];
var WAND_VALUES  = [2, 4, 8, 16, 32, 64];

var COLORS = {};
COLORS[0]    = '#cdc1b4';
COLORS[2]    = '#eee4da';
COLORS[4]    = '#ede0c8';
COLORS[8]    = '#f2b179';
COLORS[16]   = '#f59563';
COLORS[32]   = '#f67c5f';
COLORS[64]   = '#f65e3b';
COLORS[128]  = '#edcf72';
COLORS[256]  = '#edcc61';
COLORS[512]  = '#edc850';
COLORS[1024] = '#edc53f';
COLORS[2048] = '#edc22e';

var TEXT_DARK = '#776e65';
var TEXT_LIGHT = '#f9f6f2';

// ========================
// STATE
// ========================
var state = {};

function initState() {
  var g = [];
  for (var r = 0; r < ROWS; r++) { var row = []; for (var c = 0; c < COLS; c++) row.push(0); g.push(row); }
  state.grid = g;
  state.score = 0;
  state.currentNumber = 2;
  state.gameOver = false;
  state.celebration = '';
  state.celebTime = 0;
  state.wandCount = 3; state.swapCount = 3; state.clearCount = 3;
  state.supremeWandCount = 1; state.dragonHandCount = 1; state.immortalCount = 1;
  state.activePower = '';
  state.hintText = '点击下方列放入数字';
  state.supremePicker = null; state.swapCell = null; state.showMenu = false;
  state.dropCells = {}; state.mergeCells = {};
  state._activeCol = -1;
  state.scrollY = 0; state.maxScrollY = 0; state.scrollVelocity = 0;
  state._dragonDrops = 0;
}

// ========================
// ANIMATION
// ========================
var tweens = [];
var pendingActions = [];
var _nextAnimId = 0;

function scheduleAction(delayMs, cb) {
  pendingActions.push({ time: Date.now() + delayMs, cb: cb });
}

function addTween(type, data, dur) {
  tweens.push({ id: _nextAnimId++, type: type, start: Date.now(), dur: dur, prog: 0, data: data });
}

function updateTweens(now) {
  var a = [];
  for (var i = 0; i < tweens.length; i++) {
    var t = tweens[i]; t.prog = Math.min(1, (now - t.start) / t.dur);
    if (t.prog < 1) a.push(t);
  }
  tweens = a;
}

function runActions(now) {
  var r = [];
  for (var i = 0; i < pendingActions.length; i++) {
    if (now >= pendingActions[i].time) { pendingActions[i].cb(); } else { r.push(pendingActions[i]); }
  }
  pendingActions = r;
}

function updateScroll() {
  if (Math.abs(state.scrollVelocity) < 0.5) { state.scrollVelocity = 0; return; }
  state.scrollVelocity *= 0.92;
  state.scrollY -= state.scrollVelocity;
  if (state.scrollY < 0) state.scrollY = 0;
  if (state.scrollY > state.maxScrollY) state.scrollY = state.maxScrollY;
}

function easeOut(t) { return t * (2 - t); }

function celebTransform(p) {
  if (p < 0.25) { var q = p / 0.25; return { s: 0.3 + 0.9 * easeOut(q), a: easeOut(q) }; }
  else if (p < 0.5) { var q = (p - 0.25) / 0.25; return { s: 1.2 - 0.2 * q, a: 1 }; }
  else { var q = (p - 0.5) / 0.5; return { s: 1.0 - 0.2 * easeOut(q), a: 1 - easeOut(q) }; }
}

// ========================
// AUDIO (stubs)
// ========================
var audio = {
  sfxEnabled: true, bgmEnabled: false, _bgm: null,
  init: function() {},
  playBgm: function() {}, pauseBgm: function() {},
  playDrop: function() {}, playMerge: function() {},
  toggleSfx: function() { this.sfxEnabled = !this.sfxEnabled; },
  toggleBgm: function() { this.bgmEnabled = !this.bgmEnabled; }
};

// ========================
// GAME LOGIC
// ========================
function generateNumber() {
  return SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
}

function isBoardFull() {
  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (state.grid[r][c] === 0) return false;
  return true;
}

function placeNumber(col, value) {
  var tr = -1;
  for (var r = ROWS - 1; r >= 0; r--) { if (state.grid[r][col] === 0) { tr = r; break; } }
  if (tr === -1) return false;
  state.grid[tr][col] = value;
  state.dropCells = {};
  state.dropCells[tr + ',' + col] = 'start';
  state.mergeCells = {};
  state._activeCol = col;
  processMerges(tr, col);
  applyGravity();
  while (scanAndMerge()) { applyGravity(); }
  return true;
}

function processMerges(row, col) {
  var v = state.grid[row][col]; if (v === 0) return;
  var dirs = [[1,0],[-1,0],[0,-1],[0,1]];
  for (var d = 0; d < 4; d++) {
    var nr = row + dirs[d][0], nc = col + dirs[d][1];
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && state.grid[nr][nc] === v) {
      state.grid[row][col] = v * 2; state.grid[nr][nc] = 0; state.score += v * 2;
      state.mergeCells[row + ',' + col] = true;
      processMerges(row, col); return;
    }
  }
}

function applyGravity() {
  for (var c = 0; c < COLS; c++) {
    var w = ROWS - 1;
    for (var r = ROWS - 1; r >= 0; r--) {
      if (state.grid[r][c] !== 0) { if (r !== w) { state.grid[w][c] = state.grid[r][c]; state.grid[r][c] = 0; } w--; }
    }
  }
}

function scanAndMerge() {
  var merged = false;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var v = state.grid[r][c]; if (v === 0) continue;
      if (r + 1 < ROWS && state.grid[r + 1][c] === v) {
        state.grid[r][c] = v * 2; state.grid[r + 1][c] = 0; state.score += v * 2;
        state.mergeCells[r + ',' + c] = true; merged = true;
      }
      if (c + 1 < COLS && state.grid[r][c + 1] === v) {
        if (c + 1 === state._activeCol) {
          state.grid[r][c + 1] = v * 2; state.grid[r][c] = 0; state.score += v * 2;
          state.mergeCells[r + ',' + (c + 1)] = true;
        } else {
          state.grid[r][c] = v * 2; state.grid[r][c + 1] = 0; state.score += v * 2;
          state.mergeCells[r + ',' + c] = true;
        }
        merged = true;
      }
    }
  }
  return merged;
}

function countMergeCells() { var n = 0; for (var k in state.mergeCells) n++; return n; }

function getBonusCount(mc) {
  if (mc >= 10) return 8 + Math.floor(Math.random() * 3);
  if (mc >= 5)  return 5 + Math.floor(Math.random() * 2);
  if (mc >= 3)  return 2 + Math.floor(Math.random() * 2);
  return 0;
}

function getCelebration(mc) {
  if (mc >= 10) return '太厉害了!'; if (mc >= 5) return '真棒!'; return '不错!';
}

function showCeleb(text, dur) {
  state.celebration = text; state.celebTime = Date.now();
  addTween('celeb', null, 900);
  scheduleAction(dur, function() { state.celebration = ''; });
}

function spawnBonuses(count) {
  state.dropCells = {}; state.mergeCells = {};
  var placed = [];
  for (var i = 0; i < count; i++) {
    var cols = [];
    for (var c = 0; c < COLS; c++) if (state.grid[0][c] === 0) cols.push(c);
    if (cols.length === 0) break;
    var col = cols[Math.floor(Math.random() * cols.length)];
    var val = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
    var tr = -1;
    for (var r = ROWS - 1; r >= 0; r--) if (state.grid[r][col] === 0) { tr = r; break; }
    if (tr === -1) continue;
    state.grid[tr][col] = val; state.dropCells[tr + ',' + col] = 'start';
    placed.push({ r: tr, c: col });
  }
  if (placed.length === 0) return 0;
  for (var p = 0; p < placed.length; p++) processMerges(placed[p].r, placed[p].c);
  applyGravity(); while (scanAndMerge()) applyGravity();
  return countMergeCells();
}

function runWave(cb, spd) {
  spd = spd || 1;
  audio.playDrop();
  var hm = false; for (var k in state.mergeCells) { hm = true; break; }
  if (hm) audio.playMerge();
  scheduleAction(Math.floor(50 / spd), function() {
    for (var k in state.dropCells) state.dropCells[k] = 'fall';
  });
  scheduleAction(Math.floor(350 / spd), function() {
    state.dropCells = {}; state.mergeCells = {}; if (cb) cb();
  });
}

function chainBonuses(mc) {
  var bonus = getBonusCount(mc);
  if (bonus === 0 || state.gameOver) return;
  if (Math.random() < 0.2) { triggerSurprise(mc); return; }
  var nm = spawnBonuses(bonus);
  var hd = false; for (var k in state.dropCells) { hd = true; break; }
  if (!hd) return;
  state.gameOver = isBoardFull();
  showCeleb(getCelebration(mc), 1500);
  runWave(function() { chainBonuses(nm); });
}

function triggerSurprise(mc) {
  var r = Math.random();
  if (r < 0.25) {
    for (var row = 0; row < ROWS; row++) for (var col = 0; col < COLS; col++) if (state.grid[row][col] === 0) state.grid[row][col] = 2;
    state.mergeCells = {}; applyGravity(); while (scanAndMerge()) applyGravity();
    state.gameOver = isBoardFull(); showCeleb('惊喜！填满2', 2000);
  } else if (r < 0.5) {
    var mn = Infinity, sm = Infinity;
    for (var row = 0; row < ROWS; row++) for (var col = 0; col < COLS; col++) {
      var v = state.grid[row][col];
      if (v > 0 && v < mn) { sm = mn; mn = v; } else if (v > mn && v < sm) sm = v;
    }
    if (sm === Infinity) sm = mn * 2;
    for (var row = 0; row < ROWS; row++) for (var col = 0; col < COLS; col++) if (state.grid[row][col] === mn) state.grid[row][col] = sm;
    showCeleb('惊喜！数字升级', 2000);
  } else if (r < 0.75) {
    var sc = Math.floor(Math.random() * (COLS - 2));
    state.dropCells = {}; state.mergeCells = {};
    for (var ci = sc; ci < sc + 3; ci++) {
      for (var ri = 0; ri < 5; ri++) {
        if (state.grid[0][ci] !== 0) break;
        var val = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
        var tr = -1; for (var rr = ROWS - 1; rr >= 0; rr--) if (state.grid[rr][ci] === 0) { tr = rr; break; }
        if (tr === -1) break;
        state.grid[tr][ci] = val; state.dropCells[tr + ',' + ci] = 'start';
      }
    }
    state.gameOver = isBoardFull(); showCeleb('惊喜！数字雨', 2000);
    runWave(function() {});
  } else {
    for (var row = 0; row < ROWS; row++) for (var col = 0; col < COLS; col++) state.grid[row][col] = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
    state.gameOver = isBoardFull(); showCeleb('惊喜！全部填满', 2000);
  }
}

// ========================
// POWER-UPS
// ========================
function selectPower(type) {
  if (state.gameOver) return;
  var cf = type + 'Count'; if (state[cf] <= 0) return;
  if (state.activePower === type) { state.activePower = ''; state.hintText = '点击下方列放入数字'; state.swapCell = null; return; }
  state.swapCell = null;
  if (type === 'wand')        { state.activePower = 'wand';         state.hintText = '点击要变换的数字'; }
  else if (type === 'swap')   { state.activePower = 'swap';         state.hintText = '点击第一个数字'; }
  else if (type === 'clear')  { state.activePower = 'clear';        state.hintText = '点击要消除的数字'; }
  else if (type === 'supremeWand') { state.activePower = 'supremeWand'; state.hintText = '点击数字，全部相同的都会变'; }
  else if (type === 'dragonHand')  triggerDragonHand();
  else if (type === 'immortal')    triggerImmortal();
}

function powerMergeLoop() {
  var m = false;
  for (var mr = 0; mr < ROWS; mr++) {
    for (var mc = 0; mc < COLS; mc++) {
      var v = state.grid[mr][mc]; if (v === 0) continue;
      if (mr + 1 < ROWS && state.grid[mr + 1][mc] === v) { state.grid[mr][mc] = v * 2; state.grid[mr + 1][mc] = 0; state.score += v * 2; m = true; }
      if (mc + 1 < COLS && state.grid[mr][mc + 1] === v) { state.grid[mr][mc] = v * 2; state.grid[mr][mc + 1] = 0; state.score += v * 2; m = true; }
    }
  }
  if (m) applyGravity();
  return m;
}

function handlePowerTap(row, col) {
  var p = state.activePower, v = state.grid[row][col];
  if (p === 'wand') {
    if (v === 0) return;
    state.grid[row][col] = WAND_VALUES[Math.floor(Math.random() * WAND_VALUES.length)];
    state.wandCount--; if (state.wandCount <= 0) state.activePower = '';
    state.hintText = state.wandCount > 0 ? '点击要变换的数字' : '点击下方列放入数字';
  } else if (p === 'swap') {
    if (v === 0) return;
    if (!state.swapCell) { state.swapCell = { row: row, col: col }; state.hintText = '点击要交换的另一个数字'; }
    else {
      var sr = state.swapCell.row, sc = state.swapCell.col;
      if (sr === row && sc === col) { state.swapCell = null; state.hintText = '点击第一个数字'; return; }
      var t = state.grid[sr][sc]; state.grid[sr][sc] = state.grid[row][col]; state.grid[row][col] = t;
      applyGravity(); while (powerMergeLoop()) {};
      state.swapCount--; state.swapCell = null;
      state.activePower = state.swapCount > 0 ? 'swap' : '';
      state.hintText = state.swapCount > 0 ? '点击第一个数字' : '点击下方列放入数字';
    }
  } else if (p === 'clear') {
    if (v === 0) return;
    state.grid[row][col] = 0; applyGravity(); while (powerMergeLoop()) {};
    state.clearCount--;
    state.activePower = state.clearCount > 0 ? 'clear' : '';
    state.hintText = state.clearCount > 0 ? '点击要消除的数字' : '点击下方列放入数字';
  } else if (p === 'supremeWand') {
    if (v === 0) return;
    var o = [v * 2, v * 4, v * 8, v * 16, v * 32];
    state.supremePicker = { base: v, options: o, row: row, col: col };
    state.activePower = ''; state.hintText = '选择要变成的数字';
  }
}

function handleSupremeTap(row, col) {
  var pk = state.supremePicker; if (state.grid[row][col] === 0) return;
  if (pk.row === row && pk.col === col) {
    state.supremePicker = null; state.activePower = state.supremeWandCount > 0 ? 'supremeWand' : '';
    state.hintText = '点击数字，全部相同的都会变'; return;
  }
  var v = state.grid[row][col];
  state.supremePicker = { base: v, options: [v*2,v*4,v*8,v*16,v*32], row: row, col: col };
}

function onSupremePick(nv) {
  var pk = state.supremePicker; if (!pk) return;
  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (state.grid[r][c] === pk.base) state.grid[r][c] = nv;
  applyGravity(); while (powerMergeLoop()) {};
  state.supremeWandCount--; state.supremePicker = null; state.hintText = '点击下方列放入数字';
  showCeleb('至尊魔法棒！', 2000);
}

function onCancelSupreme() {
  state.supremePicker = null; state.activePower = state.supremeWandCount > 0 ? 'supremeWand' : '';
  state.hintText = '点击数字，全部相同的都会变';
}

function triggerDragonHand() {
  if (state.dragonHandCount <= 0 || state.gameOver) return;
  state.dragonHandCount--; state.activePower = ''; state.hintText = '点击下方列放入数字';
  showCeleb('龙王的手！', 3000); state._dragonDrops = 20; doDragonWave();
}

function doDragonWave() {
  if (state._dragonDrops <= 0 || state.gameOver) return;
  var cnt = 2 + Math.floor(Math.random() * 2);
  if (cnt > state._dragonDrops) cnt = state._dragonDrops;
  state._dragonDrops -= cnt; state.dropCells = {}; state.mergeCells = {};
  for (var i = 0; i < cnt; i++) {
    var mn = Infinity;
    for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) if (state.grid[r][c] > 0) { if (state.grid[r][c] < mn) mn = state.grid[r][c]; break; }
    var v = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)]; if (mn !== Infinity && v > mn) v = mn;
    var mc = [], nc = [];
    for (var c = 0; c < COLS; c++) {
      if (state.grid[0][c] !== 0) continue; var hm = false, hn = false;
      for (var r = 0; r < ROWS; r++) { if (state.grid[r][c] === v) hm = true; if (state.grid[r][c] === v * 2) hn = true; }
      if (hm) mc.push(c); else if (hn) nc.push(c);
    }
    var tcs = mc.length > 0 ? mc : (nc.length > 0 ? nc : []);
    if (tcs.length === 0) for (var c = 0; c < COLS; c++) if (state.grid[0][c] === 0) tcs.push(c);
    if (tcs.length === 0) return;
    var col = tcs[Math.floor(Math.random() * tcs.length)];
    var tr = -1; for (var r = ROWS - 1; r >= 0; r--) if (state.grid[r][col] === 0) { tr = r; break; }
    if (tr === -1) continue;
    state.grid[tr][col] = v; state.dropCells[tr + ',' + col] = 'start';
  }
  state.gameOver = isBoardFull();
  runWave(function() {
    var ks = []; for (var k in state.dropCells) ks.push(k);
    state.mergeCells = {};
    for (var p = 0; p < ks.length; p++) { var ps = ks[p].split(','); processMerges(parseInt(ps[0]), parseInt(ps[1])); }
    applyGravity(); while (scanAndMerge()) applyGravity(); applyGravity();
    doDragonWave();
  }, 3);
}

function triggerImmortal() {
  if (state.immortalCount <= 0 || state.gameOver) return;
  state.immortalCount--; state.activePower = ''; state.hintText = '点击下方列放入数字';
  showCeleb('绝世仙尊！', 3000);
  state.dropCells = {}; state.mergeCells = {};
  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { state.grid[r][c] = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)]; state.dropCells[r + ',' + c] = 'start'; }
  runWave(function() { immortalMerge(); });
}

function immortalMerge() {
  applyGravity(); state.mergeCells = {}; var m = false;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var v = state.grid[r][c]; if (v === 0) continue;
      if (r + 1 < ROWS && state.grid[r + 1][c] === v) { state.grid[r][c] = v * 2; state.grid[r + 1][c] = 0; state.score += v * 2; state.mergeCells[r + ',' + c] = true; m = true; }
      if (c + 1 < COLS && state.grid[r][c + 1] === v) { state.grid[r][c] = v * 2; state.grid[r][c + 1] = 0; state.score += v * 2; state.mergeCells[r + ',' + c] = true; m = true; }
    }
  }
  if (!m) { state.gameOver = isBoardFull(); return; }
  audio.playMerge(); scheduleAction(200, function() { immortalMerge(); });
}

// ========================
// RENDERER
// ========================
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function drawCellBg(ctx, x, y, w, h, v) {
  ctx.fillStyle = COLORS[v] || COLORS[0]; rr(ctx, x, y, w, h, 8 * SCALE); ctx.fill();
}

function drawCellNum(ctx, x, y, w, h, v) {
  if (v <= 0) return;
  ctx.fillStyle = v <= 4 ? TEXT_DARK : TEXT_LIGHT;
  var fs = 28;
  if (v >= 1024) fs = 20; else if (v >= 512) fs = 22; else if (v >= 128) fs = 24;
  ctx.font = 'bold ' + (fs * SCALE) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(v), x + w / 2, y + h / 2);
}

function render() {
  ctx.fillStyle = '#faf8ef'; ctx.fillRect(0, 0, W, H);

  // Header
  var pad = 30 * SCALE;
  ctx.fillStyle = TEXT_DARK; ctx.font = 'bold ' + (40 * SCALE) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('数字合成', pad, 20 * SCALE + 10 * SCALE);

  // Score
  var sbW = 130 * SCALE, sbH = 70 * SCALE, sbX = W - sbW - pad, sbY = 20 * SCALE;
  ctx.fillStyle = '#bbada0'; rr(ctx, sbX, sbY, sbW, sbH, 8 * SCALE); ctx.fill();
  ctx.fillStyle = '#f9f6f2'; ctx.textAlign = 'center';
  ctx.font = (22 * SCALE) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.fillText('分数', sbX + sbW / 2, sbY + 12 * SCALE);
  ctx.font = 'bold ' + (36 * SCALE) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.fillText(String(state.score), sbX + sbW / 2, sbY + 36 * SCALE);

  // Hamburger
  var btnX = sbX - 66 * SCALE, btnYH = sbY + 7 * SCALE, btnW = 56 * SCALE, btnH = 56 * SCALE;
  ctx.fillStyle = '#bbada0'; rr(ctx, btnX, btnYH, btnW, btnH, 8 * SCALE); ctx.fill();
  ctx.fillStyle = '#f9f6f2';
  for (var i = 0; i < 3; i++) rr(ctx, btnX + 12 * SCALE, btnYH + 17 * SCALE + i * 12 * SCALE, 32 * SCALE, 4 * SCALE, 2 * SCALE), ctx.fill();

  // Next number
  var cy = 100 * SCALE;
  ctx.fillStyle = TEXT_DARK; ctx.font = (24 * SCALE) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('下一个数字', W / 2, cy + 4 * SCALE);
  var cs = 90 * SCALE, cx = W / 2 - cs / 2, ccy = cy + 30 * SCALE;
  drawCellBg(ctx, cx, ccy, cs, cs, state.currentNumber);
  drawCellNum(ctx, cx, ccy, cs, cs, state.currentNumber);

  // Basic power buttons
  var pw = 64 * SCALE, ppx = W - 30 * SCALE - pw, ppy = cy + 10 * SCALE;
  var powers = ['wand', 'swap', 'clear'];
  for (var i = 0; i < 3; i++) {
    var bx = ppx - i * (pw + 8 * SCALE), type = powers[i], cnt = state[type + 'Count'];
    var act = state.activePower === type, emp = cnt <= 0;
    ctx.globalAlpha = emp ? 0.35 : 1;
    ctx.fillStyle = act ? '#f5f0eb' : '#ffffff'; rr(ctx, bx, ppy, pw, pw, 8 * SCALE); ctx.fill();
    ctx.strokeStyle = act ? '#8f7a66' : '#e8e0d8'; ctx.lineWidth = 2 * SCALE; rr(ctx, bx, ppy, pw, pw, 8 * SCALE); ctx.stroke();
    ctx.fillStyle = TEXT_DARK; ctx.font = (20 * SCALE) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(type === 'wand' ? '变' : (type === 'swap' ? '换' : '消'), bx + pw / 2, ppy + pw * 0.45);
    ctx.fillStyle = '#bbada0'; ctx.font = (14 * SCALE) + 'px "Helvetica Neue",Arial,sans-serif';
    ctx.fillText('x' + cnt, bx + pw / 2, ppy + pw * 0.72);
    ctx.globalAlpha = 1;
  }

  // Upgrade power row
  if (!state.supremePicker) {
    var uy = 210 * SCALE, uw = 150 * SCALE, uh = 46 * SCALE;
    var items = [{ t: 'supremeWand', l: '至尊魔法棒' }, { t: 'dragonHand', l: '龙王的手' }, { t: 'immortal', l: '绝世仙尊' }];
    var total = items.length * uw + 2 * 12 * SCALE, sx = (W - total) / 2;
    for (var i = 0; i < 3; i++) {
      var it = items[i], ux = sx + i * (uw + 12 * SCALE);
      ctx.globalAlpha = state[it.t + 'Count'] <= 0 ? 0.35 : 1;
      ctx.fillStyle = state.activePower === it.t ? '#f5f0eb' : '#ffffff';
      rr(ctx, ux, uy, uw, uh, 20 * SCALE); ctx.fill();
      ctx.strokeStyle = state.activePower === it.t ? '#8f7a66' : '#e8e0d8'; ctx.lineWidth = 2 * SCALE; rr(ctx, ux, uy, uw, uh, 20 * SCALE); ctx.stroke();
      ctx.fillStyle = TEXT_DARK; ctx.font = (22 * SCALE) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(it.l, ux + uw / 2, uy + uh / 2); ctx.globalAlpha = 1;
    }
  }

  // Supreme picker
  if (state.supremePicker) {
    var spy = 100 * SCALE;
    ctx.fillStyle = '#bbada0'; ctx.font = (22 * SCALE) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(state.hintText, W / 2, spy + 8 * SCALE);
    var exS = 50 * SCALE, ex = 20 * SCALE, ey = spy + 30 * SCALE;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2 * SCALE;
    ctx.beginPath(); ctx.arc(ex + exS/2, ey + exS/2, exS/2, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#999'; ctx.font = (26 * SCALE) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✕', ex + exS/2, ey + exS/2);
    var opts = state.supremePicker.options, ow = 90 * SCALE, oh = 70 * SCALE, ox0 = ex + exS + 16 * SCALE;
    for (var i = 0; i < opts.length; i++) {
      var ox = ox0 + i * (ow + 10 * SCALE);
      drawCellBg(ctx, ox, ey, ow, oh, opts[i]); drawCellNum(ctx, ox, ey, ow, oh, opts[i]);
    }
  }

  // Hint
  var hy = 256 * SCALE;
  ctx.fillStyle = '#bbada0'; ctx.font = (22 * SCALE) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(state.hintText, W / 2, hy + 4 * SCALE);

  // Board
  var BOARD_TOP = 306;
  var bt = BOARD_TOP * SCALE - state.scrollY;
  var cw = CELL_W * SCALE, ch = CELL_H * SCALE, gap = GAP * SCALE, rh = ROW_H * SCALE;
  var tbw = COLS * cw + (COLS - 1) * gap, bl = (W - tbw) / 2;
  var vh = H - BOARD_TOP * SCALE;
  state.maxScrollY = Math.max(0, ROWS * rh - vh);

  ctx.save(); ctx.beginPath(); ctx.rect(0, BOARD_TOP * SCALE, W, vh); ctx.clip();
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var dx = bl + c * (cw + gap), dy = bt + r * rh;
      if (dy + ch < BOARD_TOP * SCALE || dy > H) continue;
      var key = r + ',' + c, off = 0;
      if (state.dropCells[key] === 'start') off = -(r * ROW_H + 150) * SCALE;
      var v = state.grid[r][c];
      drawCellBg(ctx, dx, dy + off, cw, ch, v);
      var hl = (state.swapCell && state.swapCell.row === r && state.swapCell.col === c) ||
               (state.supremePicker && state.supremePicker.row === r && state.supremePicker.col === c);
      if (hl) { ctx.save(); ctx.strokeStyle = '#f2b179'; ctx.lineWidth = 4 * SCALE; ctx.shadowColor = '#f2b179'; ctx.shadowBlur = 12 * SCALE; rr(ctx, dx, dy + off, cw, ch, 8 * SCALE); ctx.stroke(); ctx.restore(); }
      drawCellNum(ctx, dx, dy + off, cw, ch, v);
    }
  }
  ctx.restore();

  // Celebration
  if (state.celebration) {
    var el = Date.now() - state.celebTime, ep = Math.min(1, el / 900);
    var t = celebTransform(ep);
    ctx.save(); ctx.globalAlpha = t.a; ctx.translate(W/2, H/2); ctx.scale(t.s, t.s);
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.font = 'bold ' + (56*SCALE) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(state.celebration, 2*SCALE, 2*SCALE);
    ctx.fillStyle = '#f65e3b'; ctx.fillText(state.celebration, 0, 0);
    ctx.restore();
  }

  // Game over
  if (state.gameOver) {
    ctx.fillStyle = 'rgba(238,228,218,0.73)'; ctx.fillRect(0, 0, W, H);
    var bw = 380 * SCALE, bh = 280 * SCALE, bbx = (W - bw)/2, bby = (H - bh)/2;
    ctx.fillStyle = '#fff'; rr(ctx, bbx, bby, bw, bh, 12*SCALE); ctx.fill();
    ctx.fillStyle = TEXT_DARK; ctx.font = 'bold '+(48*SCALE)+'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('游戏结束', W/2, bby+70*SCALE);
    ctx.font = (32*SCALE)+'px "Helvetica Neue",Arial,sans-serif'; ctx.fillText('得分: '+state.score, W/2, bby+140*SCALE);
    var rw = 200*SCALE, rh2 = 56*SCALE, rrx = (W-rw)/2, rry = bby+190*SCALE;
    ctx.fillStyle = '#8f7a66'; rr(ctx, rrx, rry, rw, rh2, 8*SCALE); ctx.fill();
    ctx.fillStyle = '#f9f6f2'; ctx.font = (28*SCALE)+'px "Helvetica Neue",Arial,sans-serif'; ctx.fillText('重新开始', W/2, rry+rh2/2);
  }

  // Menu
  if (state.showMenu) {
    ctx.fillStyle = 'rgba(0,0,0,0.01)'; ctx.fillRect(0, 0, W, H);
    var mw = 280 * SCALE, mx = W - 30*SCALE - mw, my = 100 * SCALE, mih = 56 * SCALE;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 24*SCALE; ctx.shadowOffsetY = 6*SCALE;
    ctx.fillStyle = '#fff'; rr(ctx, mx, my, mw, mih*3, 10*SCALE); ctx.fill(); ctx.restore();
    var mis = [{ l: '音效', t: 'sfx' }, { l: '背景音乐', t: 'bgm' }, { l: '重新开始', t: 'restart' }];
    for (var i = 0; i < 3; i++) {
      var miy = my + i * mih;
      ctx.fillStyle = TEXT_DARK; ctx.font = (28*SCALE)+'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(mis[i].l, mx+30*SCALE, miy+mih/2);
      if (mis[i].t !== 'restart') {
        var on = mis[i].t === 'sfx' ? audio.sfxEnabled : audio.bgmEnabled;
        var tx = mx+mw-90*SCALE, ty = miy+(mih-36*SCALE)/2, tw = 64*SCALE, th = 36*SCALE, kr = 14*SCALE;
        ctx.fillStyle = on ? '#8f7a66' : '#cdc1b4'; rr(ctx, tx, ty, tw, th, 18*SCALE); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc((on ? tx+tw-4*SCALE-kr*2 : tx+4*SCALE)+kr, ty+(th-kr*2)/2+kr, kr, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.strokeStyle = '#e8e0d8'; ctx.lineWidth = 1*SCALE; ctx.beginPath(); ctx.moveTo(mx+30*SCALE, miy); ctx.lineTo(mx+mw-30*SCALE, miy); ctx.stroke();
      }
    }
  }
}

// ========================
// INPUT
// ========================
var _tsX = 0, _tsY = 0, _tsT = 0, _isS = false, _sbY = 0, _ld = 0, _lt = 0;

wx.onTouchStart(function(e) {
  var t = e.touches[0]; _tsX = t.clientX; _tsY = t.clientY; _tsT = Date.now();
  _isS = false; _sbY = state.scrollY; _ld = 0; _lt = _tsT;
});
wx.onTouchMove(function(e) {
  var t = e.touches[0], dy = _tsY - t.clientY;
  if (!_isS && Math.abs(dy) > 8 && Math.abs(_tsX - t.clientX) < Math.abs(dy) * 2) _isS = true;
  if (_isS) { state.scrollY = _sbY + dy; if (state.scrollY < 0) state.scrollY = 0; if (state.scrollY > state.maxScrollY) state.scrollY = state.maxScrollY; _ld = t.clientY - _tsY; _lt = Date.now(); }
});
wx.onTouchEnd(function(e) {
  if (_isS) { var dt = Date.now() - _lt; if (dt > 0 && dt < 100) state.scrollVelocity = -_ld / dt * 16; return; }
  if (Date.now() - _tsT > 300) return;
  hitTest(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
});

function hitTest(x, y) {
  if (state.gameOver) { restartGame(); return; }
  if (state.showMenu) { var mh = hitMenu(x,y); if (mh) { if (mh === 'sfx') audio.toggleSfx(); else if (mh === 'bgm') audio.toggleBgm(); else if (mh === 'rst') restartGame(); return; } state.showMenu = false; return; }
  if (state.supremePicker) { var pv = hitPicker(x,y); if (pv === 'exit') { onCancelSupreme(); return; } if (pv > 0) { onSupremePick(pv); return; } }
  if (hitMenuBtn(x,y)) { state.showMenu = !state.showMenu; return; }
  var pw = hitPower(x,y); if (pw) { selectPower(pw); return; }
  var up = hitUpgrade(x,y); if (up) { selectPower(up); return; }
  var cell = hitCell(x,y); if (cell) { onCellTap(cell.r, cell.c); }
}

function hitMenuBtn(x,y) { var bx = W - 66*SCALE - 56*SCALE, by = 20*SCALE + 7*SCALE, bw = 56*SCALE, bh = 56*SCALE; return x >= bx && x <= bx+bw && y >= by && y <= by+bh; }

function hitPower(x,y) {
  var py = 100*SCALE + 10*SCALE, pw = 64*SCALE, px = W - 30*SCALE - pw, types = ['wand','swap','clear'];
  for (var i = 0; i < 3; i++) { var bx = px - i*(pw+8*SCALE); if (x >= bx && x <= bx+pw && y >= py && y <= py+pw) return types[i]; }
  return null;
}

function hitUpgrade(x,y) {
  var uy = 210*SCALE, uw = 150*SCALE, uh = 46*SCALE, its = ['supremeWand','dragonHand','immortal'];
  var total = its.length*uw + 2*12*SCALE, sx = (W-total)/2;
  for (var i = 0; i < 3; i++) { var bx = sx + i*(uw+12*SCALE); if (x >= bx && x <= bx+uw && y >= uy && y <= uy+uh) return its[i]; }
  return null;
}

function hitCell(x,y) {
  var cw = CELL_W*SCALE, ch = CELL_H*SCALE, gap = GAP*SCALE, rh = ROW_H*SCALE;
  var tbw = COLS*cw + (COLS-1)*gap, bl = (W-tbw)/2, bt = 306*SCALE - state.scrollY;
  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
    var cx = bl + c*(cw+gap), cy = bt + r*rh;
    if (x >= cx && x <= cx+cw && y >= cy && y <= cy+ch) return { r: r, c: c };
  }
  return null;
}

function hitPicker(x,y) {
  var py = 100*SCALE + 30*SCALE, exS = 50*SCALE, ecx = 20*SCALE + exS/2, ecy = py + exS/2;
  if ((x-ecx)*(x-ecx) + (y-ecy)*(y-ecy) <= (exS/2)*(exS/2)) return 'exit';
  var ow = 90*SCALE, oh = 70*SCALE, ox0 = 20*SCALE + exS + 16*SCALE, opts = state.supremePicker.options;
  for (var i = 0; i < opts.length; i++) { var ox = ox0 + i*(ow+10*SCALE); if (x >= ox && x <= ox+ow && y >= py && y <= py+oh) return opts[i]; }
  return 0;
}

function hitMenu(x,y) {
  var mw = 280*SCALE, mx = W-30*SCALE-mw, my = 100*SCALE, mih = 56*SCALE;
  if (x >= mx && x <= mx+mw && y >= my && y <= my+mih*3) { var idx = Math.floor((y-my)/mih); return idx === 0 ? 'sfx' : (idx === 1 ? 'bgm' : 'rst'); }
  return null;
}

function onCellTap(row, col) {
  if (state.gameOver) return;
  if (state.supremePicker) { handleSupremeTap(row,col); return; }
  if (state.activePower) { handlePowerTap(row,col); return; }
  if (!placeNumber(col, state.currentNumber)) return;
  var mc = countMergeCells(); state.currentNumber = generateNumber(); state.gameOver = isBoardFull();
  runWave(function() { chainBonuses(mc); });
}

function restartGame() {
  state.showMenu = false; state.gameOver = false; state.score = 0;
  state.activePower = ''; state.hintText = '点击下方列放入数字'; state.supremePicker = null; state.swapCell = null;
  state.wandCount = 3; state.swapCount = 3; state.clearCount = 3; state.supremeWandCount = 1; state.dragonHandCount = 1; state.immortalCount = 1;
  state.dropCells = {}; state.mergeCells = {}; state.scrollY = 0;
  initState(); state.currentNumber = generateNumber();
  console.log('[GAME] Restarted');
}

// ========================
// GAME LOOP
// ========================
function gameLoop(ts) {
  var now = ts || Date.now();
  updateTweens(now); runActions(now); updateScroll();
  render();
  requestAnimationFrame(gameLoop);
}

// ========================
// INIT
// ========================
function init() {
  console.log('[GAME] init()');
  initState(); state.currentNumber = generateNumber();
  console.log('[GAME] Starting game loop');
  requestAnimationFrame(gameLoop);
}

init();
console.log('[GAME] Loaded');
