// 数字合成 - 微信小游戏 (两模式版)
console.log('[GAME] init');

var canvas = wx.createCanvas();
var ctx = canvas.getContext('2d');
var sys = wx.getSystemInfoSync();
var W = sys.windowWidth;
var H = sys.windowHeight;
ctx.fillStyle = '#faf8ef'; ctx.fillRect(0, 0, W, H);

// ======================== CONSTANTS ========================
var ROWS = 9;
var COLS = 6;
var CELL_H = 110;
var GAP = 6;
var CELL_W = 110;
var ROW_H = CELL_H + GAP;
var DESIGN_W = 750;
var SPAWN_VALUES = [2, 4, 8, 16, 32];
var WAND_VALUES = [2, 4, 8, 16, 32, 64];
var POWER_COST = 100000000;
var SCALE = W / DESIGN_W;

var COLORS = {0:'#cdc1b4',2:'#eee4da',4:'#ede0c8',8:'#f2b179',16:'#f59563',32:'#f67c5f',64:'#f65e3b',128:'#edcf72',256:'#edcc61',512:'#edc850',1024:'#edc53f',2048:'#edc22e'};

// ======================== STATE ========================
var state = {};
function initState() {
  var g = [];
  for (var r = 0; r < ROWS; r++) { var row = []; for (var c = 0; c < COLS; c++) row.push(0); g.push(row); }
  state.grid = g; state.score = 0; state.coins = 0;
  state.currentNumber = 2; state.gameOver = false;
  state.version = '普通版';
  state.celebration = ''; state.celebTime = 0;
  state.wandCount = 0; state.swapCount = 0; state.clearCount = 0;
  state.supremeWandCount = 0; state.dragonHandCount = 0; state.immortalCount = 0;
  state.activePower = ''; state.hintText = '点击下方列放入数字';
  state.supremePicker = null; state.swapCell = null; state.showMenu = false;
  state.dropCells = {}; state.mergeCells = {}; state._activeCol = -1;
  state.scrollY = 0; state.maxScrollY = 0; state.scrollVelocity = 0;
  state._dragonDrops = 0;
}

// ======================== LAYOUT ========================
var LAYOUT = {};
LAYOUT.topPad = 45;
LAYOUT.headerH = 56;
LAYOUT.controlH = 90;
LAYOUT.upgradeH = 44;
LAYOUT.hintH = 28;
LAYOUT.boardTop = LAYOUT.topPad + LAYOUT.headerH + LAYOUT.controlH + LAYOUT.upgradeH + LAYOUT.hintH + 6;

// ======================== ANIMATION ========================
var tweens = [];
var pendingActions = [];
var _nextTid = 0;
function scheduleAction(delay, cb) { pendingActions.push({ time: Date.now() + delay, cb: cb }); }
function addTween(type, data, dur) { tweens.push({ id: _nextTid++, type: type, start: Date.now(), dur: dur, prog: 0, data: data }); }
function updateTweens(now) { var a = []; for (var i = 0; i < tweens.length; i++) { var t = tweens[i]; t.prog = Math.min(1, (now - t.start) / t.dur); if (t.prog < 1) a.push(t); } tweens = a; }
function runActions(now) { var r = []; for (var i = 0; i < pendingActions.length; i++) { if (now >= pendingActions[i].time) { pendingActions[i].cb(); } else { r.push(pendingActions[i]); } } pendingActions = r; }
function updateScroll() { if (Math.abs(state.scrollVelocity) < 0.5) { state.scrollVelocity = 0; return; } state.scrollVelocity *= 0.92; state.scrollY -= state.scrollVelocity; if (state.scrollY < 0) state.scrollY = 0; if (state.scrollY > state.maxScrollY) state.scrollY = state.maxScrollY; }
function easeOut(t) { return t * (2 - t); }
function celebTransform(p) { if (p < 0.25) { var q = p / 0.25; return { s: 0.3 + 0.9 * easeOut(q), a: easeOut(q) }; } else if (p < 0.5) { var q = (p - 0.25) / 0.25; return { s: 1.2 - 0.2 * q, a: 1 }; } else { var q = (p - 0.5) / 0.5; return { s: 1.0 - 0.2 * easeOut(q), a: 1 - easeOut(q) }; } }

// ======================== AUDIO ========================
var audio = { sfxEnabled: true, bgmEnabled: false, init: function() {}, playBgm: function() {}, pauseBgm: function() {}, playDrop: function() {}, playMerge: function() {}, toggleSfx: function() { this.sfxEnabled = !this.sfxEnabled; }, toggleBgm: function() { this.bgmEnabled = !this.bgmEnabled; } };

// ======================== GAME LOGIC ========================
function generateNumber() { return SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)]; }
function isBoardFull() { for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (state.grid[r][c] === 0) return false; return true; }
function countMergeCells() { var n = 0; for (var k in state.mergeCells) n++; return n; }

function earnCoins(mergeCount) { if (mergeCount <= 0) return 0; var earned = Math.pow(2, mergeCount + 1); state.coins = (state.coins || 0) + earned; return earned; }

function handleMaxTiles() {
  if (ROWS !== 9) return;
  var found = false;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      if (state.grid[r][c] >= 2048) { state.coins += Math.floor(state.grid[r][c] / 2048) * 100000; state.grid[r][c] = 0; found = true; }
    }
  }
  if (found) { applyGravity(); while (scanAndMerge()) applyGravity(); handleMaxTiles(); }
}

function placeNumber(col, value) {
  var tr = -1;
  for (var r = ROWS - 1; r >= 0; r--) { if (state.grid[r][col] === 0) { tr = r; break; } }
  if (tr === -1) return false;
  state.grid[tr][col] = value; state.dropCells = {}; state.dropCells[tr + ',' + col] = 'start';
  state.mergeCells = {}; state._activeCol = col;
  processMerges(tr, col); applyGravity(); while (scanAndMerge()) applyGravity();
  return true;
}
function processMerges(row, col) {
  var v = state.grid[row][col]; if (v === 0) return;
  var dirs = [[1,0],[-1,0],[0,-1],[0,1]];
  for (var d = 0; d < 4; d++) {
    var nr = row + dirs[d][0], nc = col + dirs[d][1];
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && state.grid[nr][nc] === v) {
      state.grid[row][col] = v * 2; state.grid[nr][nc] = 0; state.score += v * 2; state.mergeCells[row + ',' + col] = true;
      processMerges(row, col); return;
    }
  }
}
function applyGravity() { for (var c = 0; c < COLS; c++) { var w = ROWS - 1; for (var r = ROWS - 1; r >= 0; r--) { if (state.grid[r][c] !== 0) { if (r !== w) { state.grid[w][c] = state.grid[r][c]; state.grid[r][c] = 0; } w--; } } } }
function scanAndMerge() {
  var merged = false;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var v = state.grid[r][c]; if (v === 0) continue;
      if (r + 1 < ROWS && state.grid[r + 1][c] === v) { state.grid[r][c] = v * 2; state.grid[r + 1][c] = 0; state.score += v * 2; state.mergeCells[r + ',' + c] = true; merged = true; }
      if (c + 1 < COLS && state.grid[r][c + 1] === v) {
        if (c + 1 === state._activeCol) { state.grid[r][c + 1] = v * 2; state.grid[r][c] = 0; state.score += v * 2; state.mergeCells[r + ',' + (c + 1)] = true; }
        else { state.grid[r][c] = v * 2; state.grid[r][c + 1] = 0; state.score += v * 2; state.mergeCells[r + ',' + c] = true; }
        merged = true;
      }
    }
  }
  return merged;
}
function getBonusCount(mc) { if (mc >= 10) return 8 + Math.floor(Math.random() * 3); if (mc >= 5) return 5 + Math.floor(Math.random() * 2); if (mc >= 3) return 2 + Math.floor(Math.random() * 2); return 0; }
function getCelebration(mc) { if (mc >= 10) return '太厉害了!'; if (mc >= 5) return '真棒!'; return '不错!'; }
function showCeleb(text, dur) { state.celebration = text; state.celebTime = Date.now(); addTween('celeb', null, 900); scheduleAction(dur || 1500, function() { state.celebration = ''; }); }

function spawnBonuses(count) {
  state.dropCells = {}; state.mergeCells = {}; var placed = [];
  for (var i = 0; i < count; i++) {
    var cols = []; for (var c = 0; c < COLS; c++) if (state.grid[0][c] === 0) cols.push(c);
    if (cols.length === 0) break;
    var col = cols[Math.floor(Math.random() * cols.length)], val = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
    var tr = -1; for (var r = ROWS - 1; r >= 0; r--) if (state.grid[r][col] === 0) { tr = r; break; }
    if (tr === -1) continue;
    state.grid[tr][col] = val; state.dropCells[tr + ',' + col] = 'start'; placed.push({ r: tr, c: col });
  }
  if (placed.length === 0) return 0;
  for (var p = 0; p < placed.length; p++) processMerges(placed[p].r, placed[p].c);
  applyGravity(); while (scanAndMerge()) applyGravity();
  return countMergeCells();
}
function runWave(cb, spd) { spd = spd || 1; audio.playDrop(); var hm = false; for (var k in state.mergeCells) { hm = true; break; } if (hm) audio.playMerge(); scheduleAction(Math.floor(50 / spd), function() { for (var k in state.dropCells) state.dropCells[k] = 'fall'; }); scheduleAction(Math.floor(350 / spd), function() { state.dropCells = {}; state.mergeCells = {}; if (cb) cb(); }); }

function chainBonuses(mc) {
  var bonus = getBonusCount(mc); if (bonus === 0 || state.gameOver) return;
  if (Math.random() < 0.2) { triggerSurprise(); return; }
  var nm = spawnBonuses(bonus); var hd = false; for (var k in state.dropCells) { hd = true; break; } if (!hd) return;
  state.gameOver = isBoardFull(); showCeleb(getCelebration(mc), 1500);
  runWave(function() { earnCoins(nm); handleMaxTiles(); chainBonuses(nm); });
}
function triggerSurprise() {
  var r = Math.random();
  if (r < 0.25) { for (var row = 0; row < ROWS; row++) for (var col = 0; col < COLS; col++) if (state.grid[row][col] === 0) state.grid[row][col] = 2; state.mergeCells = {}; applyGravity(); while (scanAndMerge()) applyGravity(); state.gameOver = isBoardFull(); earnCoins(countMergeCells()); handleMaxTiles(); showCeleb('惊喜！填满2', 2000); }
  else if (r < 0.5) { var mn = Infinity, sm = Infinity; for (var row = 0; row < ROWS; row++) for (var col = 0; col < COLS; col++) { var v = state.grid[row][col]; if (v > 0 && v < mn) { sm = mn; mn = v; } else if (v > mn && v < sm) sm = v; } if (sm === Infinity) sm = mn * 2; for (var row = 0; row < ROWS; row++) for (var col = 0; col < COLS; col++) if (state.grid[row][col] === mn) state.grid[row][col] = sm; showCeleb('惊喜！数字升级', 2000); }
  else if (r < 0.75) { var sc = Math.floor(Math.random() * (COLS - 2)); state.dropCells = {}; state.mergeCells = {}; for (var ci = sc; ci < sc + 3; ci++) { for (var ri = 0; ri < 5; ri++) { if (state.grid[0][ci] !== 0) break; var val = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)]; var tr = -1; for (var rr = ROWS - 1; rr >= 0; rr--) if (state.grid[rr][ci] === 0) { tr = rr; break; } if (tr === -1) break; state.grid[tr][ci] = val; state.dropCells[tr + ',' + ci] = 'start'; } } state.gameOver = isBoardFull(); showCeleb('惊喜！数字雨', 2000); runWave(function() {}); }
  else { for (var row = 0; row < ROWS; row++) for (var col = 0; col < COLS; col++) state.grid[row][col] = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)]; state.gameOver = isBoardFull(); earnCoins(countMergeCells()); handleMaxTiles(); showCeleb('惊喜！全部填满', 2000); }
}

// ======================== POWER-UPS ========================
function buyPowerUp(type) {
  if (state.coins < POWER_COST) { state.hintText = '金币不足！需要' + (POWER_COST / 10000) + '万金币'; scheduleAction(2000, function() { state.hintText = '点击下方列放入数字'; }); return; }
  state.coins -= POWER_COST;
  var cf = type + 'Count'; state[cf] = 1;
  state.hintText = '购买成功！'; scheduleAction(1500, function() { state.hintText = '点击下方列放入数字'; });
  activatePower(type);
}
function watchAd(type) {
  wx.showModal({ title: '观看广告', content: '观看广告后获得道具使用机会', success: function(res) { if (res.confirm) { var cf = type + 'Count'; state[cf] = 1; activatePower(type); } } });
}
function activatePower(type) {
  if (type === 'wand') { state.activePower = 'wand'; state.hintText = '点击要变换的数字'; }
  else if (type === 'swap') { state.activePower = 'swap'; state.hintText = '点击第一个数字'; }
  else if (type === 'clear') { state.activePower = 'clear'; state.hintText = '点击要消除的数字'; }
  else if (type === 'supremeWand') { state.activePower = 'supremeWand'; state.hintText = '点击数字，全部相同的都会变'; }
  else if (type === 'dragonHand') { state.dragonHandCount--; activatePower(''); triggerDragonHand(); }
  else if (type === 'immortal') { state.immortalCount--; activatePower(''); triggerImmortal(); }
  else { state.activePower = ''; state.hintText = '点击下方列放入数字'; state.swapCell = null; }
}
function selectPower(type) {
  if (state.gameOver) return;
  if (state.activePower === type) { activatePower(''); return; }
  var count = state[type + 'Count'];
  if (count <= 0) { if (type === 'supremeWand' || type === 'dragonHand' || type === 'immortal') { watchAd(type); } else { buyPowerUp(type); } return; }
  state.swapCell = null; activatePower(type);
}
function powerMergeLoop() { var m = false; for (var mr = 0; mr < ROWS; mr++) { for (var mc = 0; mc < COLS; mc++) { var v = state.grid[mr][mc]; if (v === 0) continue; if (mr + 1 < ROWS && state.grid[mr + 1][mc] === v) { state.grid[mr][mc] = v * 2; state.grid[mr + 1][mc] = 0; state.score += v * 2; m = true; } if (mc + 1 < COLS && state.grid[mr][mc + 1] === v) { state.grid[mr][mc] = v * 2; state.grid[mr][mc + 1] = 0; state.score += v * 2; m = true; } } } if (m) applyGravity(); return m; }
function handlePowerTap(row, col) {
  var p = state.activePower, v = state.grid[row][col];
  if (p === 'wand') { if (v === 0) return; state.grid[row][col] = WAND_VALUES[Math.floor(Math.random() * WAND_VALUES.length)]; state.wandCount--; activatePower(state.wandCount > 0 ? 'wand' : ''); state.hintText = state.wandCount > 0 ? '点击要变换的数字' : '点击下方列放入数字'; }
  else if (p === 'swap') { if (v === 0) return; if (!state.swapCell) { state.swapCell = { row: row, col: col }; state.hintText = '点击要交换的另一个数字'; } else { var sr = state.swapCell.row, sc = state.swapCell.col; if (sr === row && sc === col) { state.swapCell = null; state.hintText = '点击第一个数字'; return; } var t = state.grid[sr][sc]; state.grid[sr][sc] = state.grid[row][col]; state.grid[row][col] = t; applyGravity(); while (powerMergeLoop()) {}; state.swapCount--; state.swapCell = null; earnCoins(1); handleMaxTiles(); activatePower(state.swapCount > 0 ? 'swap' : ''); state.hintText = state.swapCount > 0 ? '点击第一个数字' : '点击下方列放入数字'; } }
  else if (p === 'clear') { if (v === 0) return; state.grid[row][col] = 0; applyGravity(); while (powerMergeLoop()) {}; state.clearCount--; earnCoins(1); handleMaxTiles(); activatePower(state.clearCount > 0 ? 'clear' : ''); state.hintText = state.clearCount > 0 ? '点击要消除的数字' : '点击下方列放入数字'; }
  else if (p === 'supremeWand') { if (v === 0) return; var o = [v * 2, v * 4, v * 8, v * 16, v * 32]; if (ROWS === 9) o = o.filter(function(v2) { return v2 !== 1024 && v2 !== 2048; }); state.supremePicker = { base: v, options: o, row: row, col: col }; activatePower(''); state.hintText = '选择要变成的数字'; }
}
function handleSupremeTap(row, col) { var pk = state.supremePicker; if (state.grid[row][col] === 0) return; if (pk.row === row && pk.col === col) { state.supremePicker = null; activatePower(state.supremeWandCount > 0 ? 'supremeWand' : ''); state.hintText = '点击数字，全部相同的都会变'; return; } var v = state.grid[row][col]; var o = [v * 2, v * 4, v * 8, v * 16, v * 32]; if (ROWS === 9) o = o.filter(function(v2) { return v2 !== 1024 && v2 !== 2048; }); state.supremePicker = { base: v, options: o, row: row, col: col }; }
function onSupremePick(nv) { var pk = state.supremePicker; if (!pk) return; for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (state.grid[r][c] === pk.base) state.grid[r][c] = nv; applyGravity(); while (powerMergeLoop()) {}; state.supremeWandCount--; state.supremePicker = null; earnCoins(countMergeCells()); handleMaxTiles(); showCeleb('至尊魔法棒！', 2000); state.hintText = '点击下方列放入数字'; }
function onCancelSupreme() { state.supremePicker = null; activatePower(state.supremeWandCount > 0 ? 'supremeWand' : ''); state.hintText = '点击数字，全部相同的都会变'; }

function triggerDragonHand() { if (state.dragonHandCount <= 0 || state.gameOver) return; state.dragonHandCount--; activatePower(''); state.hintText = '点击下方列放入数字'; showCeleb('龙王的手！', 3000); state._dragonDrops = 20; doDragonWave(); }
function doDragonWave() { if (state._dragonDrops <= 0 || state.gameOver) return; var cnt = 2 + Math.floor(Math.random() * 2); if (cnt > state._dragonDrops) cnt = state._dragonDrops; state._dragonDrops -= cnt; state.dropCells = {}; state.mergeCells = {}; for (var i = 0; i < cnt; i++) { var mn = Infinity; for (var c = 0; c < COLS; c++) for (var r = 0; r < ROWS; r++) if (state.grid[r][c] > 0) { if (state.grid[r][c] < mn) mn = state.grid[r][c]; break; } var v = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)]; if (mn !== Infinity && v > mn) v = mn; var mc = [], nc = []; for (var c = 0; c < COLS; c++) { if (state.grid[0][c] !== 0) continue; var hm = false, hn = false; for (var r = 0; r < ROWS; r++) { if (state.grid[r][c] === v) hm = true; if (state.grid[r][c] === v * 2) hn = true; } if (hm) mc.push(c); else if (hn) nc.push(c); } var tcs = mc.length > 0 ? mc : (nc.length > 0 ? nc : []); if (tcs.length === 0) for (var c = 0; c < COLS; c++) if (state.grid[0][c] === 0) tcs.push(c); if (tcs.length === 0) return; var col = tcs[Math.floor(Math.random() * tcs.length)]; var tr = -1; for (var r = ROWS - 1; r >= 0; r--) if (state.grid[r][col] === 0) { tr = r; break; } if (tr === -1) continue; state.grid[tr][col] = v; state.dropCells[tr + ',' + col] = 'start'; } state.gameOver = isBoardFull(); runWave(function() { var ks = []; for (var k in state.dropCells) ks.push(k); state.mergeCells = {}; for (var p = 0; p < ks.length; p++) { var ps = ks[p].split(','); processMerges(parseInt(ps[0]), parseInt(ps[1])); } applyGravity(); while (scanAndMerge()) applyGravity(); applyGravity(); earnCoins(countMergeCells()); handleMaxTiles(); doDragonWave(); }, 3); }

function triggerImmortal() { if (state.immortalCount <= 0 || state.gameOver) return; state.immortalCount--; activatePower(''); state.hintText = '点击下方列放入数字'; showCeleb('绝世仙尊！', 3000); state.dropCells = {}; state.mergeCells = {}; for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { state.grid[r][c] = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)]; state.dropCells[r + ',' + c] = 'start'; } runWave(function() { immortalMerge(); }); }
function immortalMerge() { applyGravity(); state.mergeCells = {}; var m = false; for (var r = 0; r < ROWS; r++) { for (var c = 0; c < COLS; c++) { var v = state.grid[r][c]; if (v === 0) continue; if (r + 1 < ROWS && state.grid[r + 1][c] === v) { state.grid[r][c] = v * 2; state.grid[r + 1][c] = 0; state.score += v * 2; state.mergeCells[r + ',' + c] = true; m = true; } if (c + 1 < COLS && state.grid[r][c + 1] === v) { state.grid[r][c] = v * 2; state.grid[r][c + 1] = 0; state.score += v * 2; state.mergeCells[r + ',' + c] = true; m = true; } } } if (!m) { state.gameOver = isBoardFull(); earnCoins(countMergeCells()); handleMaxTiles(); return; } scheduleAction(200, function() { immortalMerge(); }); }

function switchVersion() {
  var isNormal = state.version === '普通版';
  var newVersion = isNormal ? '加强版' : '普通版';
  wx.showModal({ title: '切换版本', content: '切换到' + newVersion + '？将清空所有数字。', success: function(res) { if (res.confirm) { ROWS = newVersion === '加强版' ? 11 : 9; CELL_H = newVersion === '加强版' ? 90 : 110; ROW_H = CELL_H + GAP; LAYOUT.boardTop = LAYOUT.topPad + LAYOUT.headerH + LAYOUT.controlH + LAYOUT.upgradeH + LAYOUT.hintH + 6; state.version = newVersion; state.showMenu = false; initState(); state.currentNumber = generateNumber(); } } });
}

// ======================== RENDERER ========================
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath(); }
function drawCellBg(ctx, x, y, w, h, v) { ctx.fillStyle = COLORS[v] || COLORS[0]; rr(ctx, x, y, w, h, 8 * SCALE); ctx.fill(); }
function drawCellNum(ctx, x, y, w, h, v) { if (v <= 0) return; ctx.fillStyle = v <= 4 ? '#776e65' : '#f9f6f2'; var fs = v >= 1024 ? 18 : (v >= 512 ? 22 : (v >= 128 ? 24 : 28)); ctx.font = 'bold ' + (fs * SCALE) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(v), x + w / 2, y + h / 2); }

function render() {
  var s = SCALE, L = LAYOUT;
  ctx.fillStyle = '#faf8ef'; ctx.fillRect(0, 0, W, H);
  var pad = 20 * s;

  // === HEADER ===
  var hy = L.topPad * s;
  ctx.fillStyle = '#776e65'; ctx.font = 'bold ' + (30 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('数字合成', pad, hy + 2 * s);
  // Score + coins box
  var ibW = 120 * s, ibX = W - ibW - pad, ibH = 48 * s;
  ctx.fillStyle = '#bbada0'; rr(ctx, ibX, hy, ibW, ibH, 8 * s); ctx.fill();
  ctx.fillStyle = '#f9f6f2'; ctx.font = (16 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('分数 ' + state.score, ibX + ibW / 2, hy + 6 * s);
  ctx.font = 'bold ' + (18 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.fillText('🪙 ' + state.coins, ibX + ibW / 2, hy + 26 * s);
  // Hamburger
  var btnS = 40 * s, btnX = ibX - btnS - 6 * s, btnY = hy + 4 * s;
  ctx.fillStyle = '#bbada0'; rr(ctx, btnX, btnY, btnS, btnS, 6 * s); ctx.fill(); ctx.fillStyle = '#f9f6f2';
  for (var i = 0; i < 3; i++) rr(ctx, btnX + 8 * s, btnY + 8 * s + i * 10 * s, 24 * s, 3 * s, 1.5 * s), ctx.fill();

  // === CONTROL ROW ===
  var crY = (L.topPad + L.headerH) * s;
  if (!state.supremePicker) {
    var ns = 60 * s, nx = pad, ny = crY + 16 * s;
    ctx.fillStyle = '#776e65'; ctx.font = (14 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('下一个数字', nx, crY);
    drawCellBg(ctx, nx, ny, ns, ns, state.currentNumber); drawCellNum(ctx, nx, ny, ns, ns, state.currentNumber);
    // Active power indicator
    if (state.activePower) { ctx.fillStyle = '#f65e3b'; ctx.font = 'bold ' + (14 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.fillText(state.hintText, nx + ns + 10 * s, crY + 20 * s); }
    // Basic power buttons (right)
    var pw = 50 * s, ppx = W - pad - pw, ppy = ny;
    for (var i = 0; i < 3; i++) {
      var pTypes = ['wand', 'swap', 'clear'], pt = pTypes[i], cnt = state[pt + 'Count'], act = state.activePower === pt;
      var bx = ppx - i * (pw + 4 * s); ctx.globalAlpha = cnt <= 0 && !act ? 0.35 : 1;
      ctx.fillStyle = act ? '#f5f0eb' : '#fff'; rr(ctx, bx, ppy, pw, pw, 6 * s); ctx.fill();
      ctx.strokeStyle = act ? '#8f7a66' : '#e8e0d8'; ctx.lineWidth = 1.5 * s; rr(ctx, bx, ppy, pw, pw, 6 * s); ctx.stroke();
      ctx.fillStyle = '#776e65'; ctx.font = (16 * s) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pt === 'wand' ? '变' : (pt === 'swap' ? '换' : '消'), bx + pw / 2, ppy + pw * 0.4);
      ctx.fillStyle = '#bbada0'; ctx.font = (10 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.fillText('x' + cnt, bx + pw / 2, ppy + pw * 0.68); ctx.globalAlpha = 1;
    }
  }
  // Supreme picker
  if (state.supremePicker) {
    var spy = crY; ctx.fillStyle = '#776e65'; ctx.font = (14 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(state.hintText, W / 2, spy);
    var es = 32 * s, ex = pad, ey = spy + 18 * s;
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5 * s; ctx.beginPath(); ctx.arc(ex + es / 2, ey + es / 2, es / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#999'; ctx.font = (16 * s) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('X', ex + es / 2, ey + es / 2);
    var opts = state.supremePicker.options, ow = 60 * s, oh = 46 * s, ox0 = ex + es + 8 * s;
    for (var i = 0; i < opts.length && ox0 + i * (ow + 4 * s) + ow < W - pad; i++) { var ox = ox0 + i * (ow + 4 * s); drawCellBg(ctx, ox, ey, ow, oh, opts[i]); drawCellNum(ctx, ox, ey, ow, oh, opts[i]); }
  }

  // === UPGRADE ROW ===
  if (!state.supremePicker) {
    var uy = (L.topPad + L.headerH + L.controlH) * s, uw = 150 * s, uh = 36 * s;
    var items = [{ t: 'supremeWand', l: '至尊魔法棒' }, { t: 'dragonHand', l: '龙王的手' }, { t: 'immortal', l: '绝世仙尊' }];
    var total = 3 * uw + 2 * 8 * s, ux0 = (W - total) / 2;
    for (var i2 = 0; i2 < 3; i2++) { var it = items[i2], ux = ux0 + i2 * (uw + 8 * s), cnt2 = state[it.t + 'Count']; ctx.globalAlpha = cnt2 <= 0 ? 0.35 : 1; ctx.fillStyle = state.activePower === it.t ? '#f5f0eb' : '#fff'; rr(ctx, ux, uy, uw, uh, 16 * s); ctx.fill(); ctx.strokeStyle = state.activePower === it.t ? '#8f7a66' : '#e8e0d8'; ctx.lineWidth = 1.5 * s; rr(ctx, ux, uy, uw, uh, 16 * s); ctx.stroke(); ctx.fillStyle = '#776e65'; ctx.font = (18 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.l, ux + uw / 2, uy + uh / 2); ctx.globalAlpha = 1; }
  }

  // === HINT ===
  var htY = (L.topPad + L.headerH + L.controlH + L.upgradeH) * s;
  ctx.fillStyle = '#bbada0'; ctx.font = (14 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(state.hintText, W / 2, htY + 2 * s);

  // === BOARD ===
  var boardTop = L.boardTop * s, availableH = H - boardTop - 6 * s;
  var bt = boardTop - state.scrollY, cw = CELL_W * s, ch = CELL_H * s, gp = GAP * s, rh = ROW_H * s;
  var tbw = COLS * cw + (COLS - 1) * gp, bl = (W - tbw) / 2;
  state.maxScrollY = Math.max(0, ROWS * rh - availableH + 10 * s);
  ctx.save(); ctx.beginPath(); ctx.rect(0, boardTop, W, availableH); ctx.clip();
  for (var r = 0; r < ROWS; r++) { for (var c = 0; c < COLS; c++) { var dx = bl + c * (cw + gp), dy = bt + r * rh; if (dy + ch < boardTop || dy > boardTop + availableH) continue; var key = r + ',' + c, off = 0; if (state.dropCells[key] === 'start') off = -(r * ROW_H + 150) * s; drawCellBg(ctx, dx, dy + off, cw, ch, state.grid[r][c]); var hl = (state.swapCell && state.swapCell.row === r && state.swapCell.col === c) || (state.supremePicker && state.supremePicker.row === r && state.supremePicker.col === c); if (hl) { ctx.save(); ctx.strokeStyle = '#f2b179'; ctx.lineWidth = 3 * s; ctx.shadowColor = '#f2b179'; ctx.shadowBlur = 8 * s; rr(ctx, dx, dy + off, cw, ch, 8 * s); ctx.stroke(); ctx.restore(); } drawCellNum(ctx, dx, dy + off, cw, ch, state.grid[r][c]); } }
  ctx.restore();

  // === CELEBRATION ===
  if (state.celebration) { var el = Date.now() - state.celebTime, ep = Math.min(1, el / 900), t = celebTransform(ep); ctx.save(); ctx.globalAlpha = t.a; ctx.translate(W / 2, H / 2); ctx.scale(t.s, t.s); ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.font = 'bold ' + (40 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(state.celebration, 2 * s, 2 * s); ctx.fillStyle = '#f65e3b'; ctx.fillText(state.celebration, 0, 0); ctx.restore(); }

  // === GAME OVER ===
  if (state.gameOver) { ctx.fillStyle = 'rgba(238,228,218,0.73)'; ctx.fillRect(0, 0, W, H); var bw = 320 * s, bh = 220 * s, bbx = (W - bw) / 2, bby = (H - bh) / 2; ctx.fillStyle = '#fff'; rr(ctx, bbx, bby, bw, bh, 12 * s); ctx.fill(); ctx.fillStyle = '#776e65'; ctx.font = 'bold ' + (40 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('游戏结束', W / 2, bby + 60 * s); ctx.font = (28 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.fillText('得分: ' + state.score, W / 2, bby + 110 * s); var rw = 180 * s, rhb = 46 * s, rrx = (W - rw) / 2, rry = bby + 150 * s; ctx.fillStyle = '#8f7a66'; rr(ctx, rrx, rry, rw, rhb, 8 * s); ctx.fill(); ctx.fillStyle = '#f9f6f2'; ctx.font = (22 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.fillText('重新开始', W / 2, rry + rhb / 2); }

  // === MENU ===
  if (state.showMenu) { ctx.fillStyle = 'rgba(0,0,0,0.01)'; ctx.fillRect(0, 0, W, H); var mw = 240 * s, mx = W - pad - mw, my = 60 * s, mih = 48 * s, mcount = 6; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 16 * s; ctx.shadowOffsetY = 4 * s; ctx.fillStyle = '#fff'; rr(ctx, mx, my, mw, mih * mcount, 10 * s); ctx.fill(); ctx.restore();
    var mis = [{ l: '切换版本(' + state.version + ')', t: 'version' }, { l: '购买魔法棒', t: 'buyWand' }, { l: '购买交换', t: 'buySwap' }, { l: '购买清除', t: 'buyClear' }, { l: '音效', t: 'sfx' }, { l: '重新开始', t: 'rst' }];
    for (var j = 0; j < mis.length; j++) { var miy = my + j * mih; ctx.fillStyle = '#776e65'; ctx.font = (18 * s) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(mis[j].l, mx + 20 * s, miy + mih / 2); if (mis[j].t === 'sfx') { var on = audio.sfxEnabled, tx = mx + mw - 70 * s, ty = miy + (mih - 28 * s) / 2, tw = 48 * s, th = 28 * s, kr = 10 * s; ctx.fillStyle = on ? '#8f7a66' : '#cdc1b4'; rr(ctx, tx, ty, tw, th, 14 * s); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc((on ? tx + tw - 3 * s - kr * 2 : tx + 3 * s) + kr, ty + th / 2, kr, 0, Math.PI * 2); ctx.fill(); } if (j === 0 || j === 3 || j === 5) { ctx.strokeStyle = '#e8e0d8'; ctx.lineWidth = 1 * s; ctx.beginPath(); ctx.moveTo(mx + 20 * s, miy); ctx.lineTo(mx + mw - 20 * s, miy); ctx.stroke(); } } }
}

// ======================== INPUT ========================
var _tsX = 0, _tsY = 0, _tsT = 0, _isS = false, _sbY = 0, _ld = 0, _lt = 0;
wx.onTouchStart(function(e) { var t = e.touches[0]; _tsX = t.clientX; _tsY = t.clientY; _tsT = Date.now(); _isS = false; _sbY = state.scrollY; _ld = 0; _lt = _tsT; });
wx.onTouchMove(function(e) { var t = e.touches[0], dy = _tsY - t.clientY; if (!_isS && Math.abs(dy) > 8 && Math.abs(_tsX - t.clientX) < Math.abs(dy) * 2) _isS = true; if (_isS) { state.scrollY = _sbY + dy; if (state.scrollY < 0) state.scrollY = 0; if (state.scrollY > state.maxScrollY) state.scrollY = state.maxScrollY; _ld = t.clientY - _tsY; _lt = Date.now(); } });
wx.onTouchEnd(function(e) { if (_isS) { var dt = Date.now() - _lt; if (dt > 0 && dt < 100) state.scrollVelocity = -_ld / dt * 16; return; } if (Date.now() - _tsT > 300) return; hitTest(e.changedTouches[0].clientX, e.changedTouches[0].clientY); });

function hitTest(x, y) { var s = SCALE; if (state.gameOver) { var gw = 320 * s, gh = 220 * s, gx = (W - gw) / 2, gy = (H - gh) / 2, rw = 180 * s, rhb = 46 * s, rrx = (W - rw) / 2, rry = gy + 150 * s; if (x >= rrx && x <= rrx + rw && y >= rry && y <= rry + rhb) { restartGame(); return; } return; } if (state.showMenu) { var mh = hitMenu(x, y); if (mh) { menuAction(mh); return; } state.showMenu = false; return; } if (state.supremePicker) { var pv = hitPicker(x, y); if (pv === 'exit') { onCancelSupreme(); return; } if (pv > 0) { onSupremePick(pv); return; } } if (hitMenuBtn(x, y)) { state.showMenu = !state.showMenu; return; } var pw = hitPower(x, y); if (pw) { selectPower(pw); return; } var up = hitUpgrade(x, y); if (up) { selectPower(up); return; } var cell = hitCell(x, y); if (cell) { onCellTap(cell.r, cell.c); } }
function menuAction(t) { if (t === 'version') switchVersion(); else if (t === 'buyWand') selectPower('wand'); else if (t === 'buySwap') selectPower('swap'); else if (t === 'buyClear') selectPower('clear'); else if (t === 'sfx') audio.toggleSfx(); else if (t === 'rst') restartGame(); }
function hitMenuBtn(x, y) { var s = SCALE, pad = 20 * s, ibW = 120 * s, ibX = W - ibW - pad, btnS = 40 * s, bx = ibX - btnS - 6 * s, by = LAYOUT.topPad * s + 4 * s; return x >= bx && x <= bx + btnS && y >= by && y <= by + btnS; }
function hitPower(x, y) { var s = SCALE, pad = 20 * s, ny = (LAYOUT.topPad + LAYOUT.headerH) * s + 16 * s, pw = 50 * s, ppx = W - pad - pw; var pTypes = ['wand', 'swap', 'clear']; for (var i = 0; i < 3; i++) { var bx = ppx - i * (pw + 4 * s); if (x >= bx && x <= bx + pw && y >= ny && y <= ny + pw) return pTypes[i]; } return null; }
function hitUpgrade(x, y) { var s = SCALE, uy = (LAYOUT.topPad + LAYOUT.headerH + LAYOUT.controlH) * s, uw = 150 * s, uh = 36 * s, total = 3 * uw + 2 * 8 * s, ux0 = (W - total) / 2, its = ['supremeWand', 'dragonHand', 'immortal']; for (var i = 0; i < 3; i++) { var bx = ux0 + i * (uw + 8 * s); if (x >= bx && x <= bx + uw && y >= uy && y <= uy + uh) return its[i]; } return null; }
function hitCell(x, y) { var s = SCALE, cw = CELL_W * s, ch = CELL_H * s, gp = GAP * s, rh = ROW_H * s, tbw = COLS * cw + (COLS - 1) * gp, bl = (W - tbw) / 2, bt = LAYOUT.boardTop * s - state.scrollY; for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { var cx = bl + c * (cw + gp), cy = bt + r * rh; if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) return { r: r, c: c }; } return null; }
function hitPicker(x, y) { var s = SCALE, crY = (LAYOUT.topPad + LAYOUT.headerH) * s, es = 32 * s, ex = 20 * s, ey = crY + 18 * s, dx = x - (ex + es / 2), dy = y - (ey + es / 2); if (dx * dx + dy * dy <= (es / 2) * (es / 2)) return 'exit'; var ow = 60 * s, oh = 46 * s, ox0 = ex + es + 8 * s, opts = state.supremePicker.options; for (var i = 0; i < opts.length; i++) { var ox = ox0 + i * (ow + 4 * s); if (x >= ox && x <= ox + ow && y >= ey && y <= ey + oh) return opts[i]; } return 0; }
function hitMenu(x, y) { var s = SCALE, mw = 240 * s, mx = W - 20 * s - mw, my = 60 * s, mih = 48 * s; if (x >= mx && x <= mx + mw && y >= my && y <= my + mih * 6) { var idx = Math.floor((y - my) / mih); var items = ['version', 'buyWand', 'buySwap', 'buyClear', 'sfx', 'rst']; return idx < items.length ? items[idx] : null; } return null; }

function onCellTap(row, col) { if (state.gameOver) return; if (state.supremePicker) { handleSupremeTap(row, col); return; } if (state.activePower) { handlePowerTap(row, col); return; } if (!placeNumber(col, state.currentNumber)) { if (isBoardFull()) { state.gameOver = true; } return; } var mc = countMergeCells(); earnCoins(mc); handleMaxTiles(); state.currentNumber = generateNumber(); state.gameOver = isBoardFull(); runWave(function() { chainBonuses(mc); }); }

function restartGame() { state.showMenu = false; initState(); state.currentNumber = generateNumber(); }

// ======================== GAME LOOP ========================
function gameLoop(ts) { var now = ts || Date.now(); updateTweens(now); runActions(now); updateScroll(); render(); requestAnimationFrame(gameLoop); }

// ======================== INIT ========================
initState(); state.currentNumber = generateNumber();
console.log('[GAME] Ready (' + state.version + ')');
requestAnimationFrame(gameLoop);
