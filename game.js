var ROWS = 11;
var COLS = 6;
var CELL_W = 110;
var CELL_H = 90;
var GAP = 6;
var ROW_H = CELL_H + GAP;

var SPAWN_VALUES = [2, 4, 8, 16, 32];
var WAND_VALUES = [2, 4, 8, 16, 32, 64];

var CELL_COLORS = {
  0:    '#cdc1b4', 2:    '#eee4da', 4:    '#ede0c8',
  8:    '#f2b179', 16:   '#f59563', 32:   '#f67c5f',
  64:   '#f65e3b', 128:  '#edcf72', 256:  '#edcc61',
  512:  '#edc850', 1024: '#edc53f', 2048: '#edc22e'
};

var TEXT_DARK  = '#776e65';
var TEXT_LIGHT = '#f9f6f2';

function getTextColor(value) { return (value <= 4) ? TEXT_DARK : TEXT_LIGHT; }

function getFontSize(value) {
  if (value >= 1024) return 20; if (value >= 512) return 22;
  if (value >= 256)  return 24; if (value >= 128) return 24;
  return 28;
}

var BG_COLOR              = '#faf8ef';
var HEADER_BG             = '#bbada0';
var HEADER_TEXT           = '#f9f6f2';
var TITLE_COLOR           = '#776e65';
var HINT_COLOR            = '#bbada0';
var OVERLAY_BG            = 'rgba(238,228,218,0.73)';
var MENU_BG               = '#ffffff';
var POWER_BORDER          = '#e8e0d8';
var POWER_ACTIVE_BORDER   = '#8f7a66';
var POWER_ACTIVE_BG       = '#f5f0eb';
var TOGGLE_ON_BG          = '#8f7a66';
var TOGGLE_OFF_BG         = '#cdc1b4';
var CELEB_COLOR           = '#f65e3b';
var SWAP_GLOW             = '#f2b179';
var NEWGAME_BG            = '#8f7a66';

var HEADER_PAD_TOP = 20;
var HEADER_H = 100;
var CONTROL_H = 110;
var UPGRADE_H = 56;
var HINT_H = 40;
var BOARD_TOP = HEADER_H + CONTROL_H + UPGRADE_H + HINT_H;
var DESIGN_W = 750;

var BGM_PATH   = '/assets/audio/bgm.mp3';
var DROP_PATH  = '/assets/audio/drop.mp3';
var MERGE_PATH = '/assets/audio/merge.mp3';



var state = {};

function initState() {
  var grid = [];
  for (var r = 0; r < ROWS; r++) {
    var row = [];
    for (var c = 0; c < COLS; c++) row.push(0);
    grid.push(row);
  }
  state.grid = grid;
  state.score = 0;
  state.currentNumber = 2;
  state.gameOver = false;
  state.celebration = '';
  state.celebTime = 0;

  state.wandCount = 3;
  state.swapCount = 3;
  state.clearCount = 3;
  state.supremeWandCount = 1;
  state.dragonHandCount = 1;
  state.immortalCount = 1;

  state.activePower = '';
  state.hintText = '点击下方列放入数字';
  state.supremePicker = null;
  state.swapCell = null;
  state.showMenu = false;

  state.dropCells = {};
  state.mergeCells = {};
  state._activeCol = -1;

  state.scrollY = 0;
  state.maxScrollY = 0;
  state.scrollVelocity = 0;

  state.sfxEnabled = true;
  state.bgmEnabled = false;

  state._dragonDrops = 0;
}


var tweens = [];
var pendingActions = [];
var _nextAnimId = 0;

function scheduleAction(delayMs, callback) {
  pendingActions.push({ time: Date.now() + delayMs, callback: callback });
}

function addTween(type, data, durationMs) {
  tweens.push({ id: _nextAnimId++, type: type, startTime: Date.now(), duration: durationMs, progress: 0, data: data });
}

function updateAnim(now) {
  var active = [];
  for (var i = 0; i < tweens.length; i++) {
    var t = tweens[i];
    t.progress = Math.min(1, (now - t.startTime) / t.duration);
    if (t.progress < 1) active.push(t);
  }
  tweens = active;
}

function processActions(now) {
  var remaining = [];
  for (var i = 0; i < pendingActions.length; i++) {
    if (now >= pendingActions[i].time) {
      pendingActions[i].callback();
    } else {
      remaining.push(pendingActions[i]);
    }
  }
  pendingActions = remaining;
}

function updateScrollInertia() {
  if (Math.abs(state.scrollVelocity) < 0.5) { state.scrollVelocity = 0; return; }
  state.scrollVelocity *= 0.92;
  state.scrollY -= state.scrollVelocity;
  if (state.scrollY < 0) state.scrollY = 0;
  if (state.scrollY > state.maxScrollY) state.scrollY = state.maxScrollY;
}

function easeOutQuad(t) { return t * (2 - t); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function getCelebTransform(progress) {
  if (progress < 0.25) {
    var p = progress / 0.25;
    return { scale: 0.3 + 0.9 * easeOutQuad(p), alpha: easeOutQuad(p) };
  } else if (progress < 0.5) {
    return { scale: 1.2 - 0.2 * p, alpha: 1 };
  } else {
    return { scale: 1.0 - 0.2 * easeOutQuad(p), alpha: 1 - easeOutQuad(p) };
  }
}



var audio = {
  sfxEnabled: true,
  bgmEnabled: false,
  _bgm: null,

  init: function() {
    var prefs = null;
    try { prefs = wx.getStorageSync('audioPrefs'); } catch (e) {}
    if (prefs) {
      this.sfxEnabled = prefs.sfxEnabled !== false;
      this.bgmEnabled = prefs.bgmEnabled === true;
    }
  },

  _save: function() {
    try { wx.setStorageSync('audioPrefs', { sfxEnabled: this.sfxEnabled, bgmEnabled: this.bgmEnabled }); } catch (e) {}
  },

  _fileExists: function(path) {
    try { wx.getFileSystemManager().accessSync(path); return true; } catch (e) { return false; }
  },

  _playSfx: function(path) {
    if (!this.sfxEnabled) return;
    if (!this._fileExists(path)) return;
    var ctx = wx.createInnerAudioContext();
    ctx.src = path;
    ctx.volume = 0.6;
    ctx.onEnded(function() { ctx.destroy(); });
    ctx.onError(function() { ctx.destroy(); });
    ctx.play();
  },

  playBgm: function() {
    if (!this.bgmEnabled) return;
    if (!this._fileExists(BGM_PATH)) return;
    if (!this._bgm) {
      this._bgm = wx.createInnerAudioContext();
      this._bgm.src = BGM_PATH;
      this._bgm.loop = true;
      this._bgm.volume = 0.4;
    }
    this._bgm.play();
  },

  pauseBgm: function() { if (this._bgm) this._bgm.pause(); },

  playDrop:  function() { this._playSfx(DROP_PATH); },
  playMerge: function() { this._playSfx(MERGE_PATH); },

  toggleSfx: function() { this.sfxEnabled = !this.sfxEnabled; this._save(); },
  toggleBgm: function() {
    this.bgmEnabled = !this.bgmEnabled; this._save();
    if (this.bgmEnabled) this.playBgm(); else this.pauseBgm();
  }
};




// ─── Helpers ────────────────────────────────────────────────

function getBonusCount(mergeCount) {
  if (mergeCount >= 10) return 8 + Math.floor(Math.random() * 3);
  if (mergeCount >= 5)  return 5 + Math.floor(Math.random() * 2);
  if (mergeCount >= 3)  return 2 + Math.floor(Math.random() * 2);
  return 0;
}

function getCelebration(mergeCount) {
  if (mergeCount >= 10) return '太厉害了!';
  if (mergeCount >= 5)  return '真棒!';
  return '不错!';
}

function generateNumber() {
  return SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
}

function countMergeCells() {
  var mc = 0;
  for (var k in state.mergeCells) mc++;
  return mc;
}

function showCelebration(text, duration) {
  state.celebration = text;
  state.celebTime = Date.now();
  addTween('celebration', null, 900);
  scheduleAction(duration, function() { state.celebration = ''; });
}

// ─── Core ──────────────────────────────────────────────────

function isBoardFull() {
  for (var r = 0; r < ROWS; r++)
    for (var c = 0; c < COLS; c++)
      if (state.grid[r][c] === 0) return false;
  return true;
}

function placeNumber(col, value) {
  var targetRow = -1;
  for (var r = ROWS - 1; r >= 0; r--) {
    if (state.grid[r][col] === 0) { targetRow = r; break; }
  }
  if (targetRow === -1) return false;
  state.grid[targetRow][col] = value;
  state.dropCells = {};
  state.dropCells[targetRow + ',' + col] = 'start';
  state.mergeCells = {};
  state._activeCol = col;
  processMerges(targetRow, col);
  applyGravity();
  while (scanAndMerge()) { applyGravity(); }
  return true;
}

function processMerges(row, col) {
  var value = state.grid[row][col];
  if (value === 0) return;
  var dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]];
  for (var d = 0; d < dirs.length; d++) {
    var nr = row + dirs[d][0], nc = col + dirs[d][1];
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
      if (state.grid[nr][nc] === value) {
        state.grid[row][col] = value * 2;
        state.grid[nr][nc] = 0;
        state.score += value * 2;
        state.mergeCells[row + ',' + col] = true;
        processMerges(row, col);
        return;
      }
    }
  }
}

function applyGravity() {
  for (var c = 0; c < COLS; c++) {
    var w = ROWS - 1;
    for (var r = ROWS - 1; r >= 0; r--) {
      if (state.grid[r][c] !== 0) {
        if (r !== w) { state.grid[w][c] = state.grid[r][c]; state.grid[r][c] = 0; }
        w--;
      }
    }
  }
}

function scanAndMerge() {
  var merged = false;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var v = state.grid[r][c];
      if (v === 0) continue;
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

function spawnBonuses(count) {
  state.dropCells = {}; state.mergeCells = {};
  var placed = [];
  for (var i = 0; i < count; i++) {
    var availCols = [];
    for (var c = 0; c < COLS; c++) if (state.grid[0][c] === 0) availCols.push(c);
    if (availCols.length === 0) break;
    var col = availCols[Math.floor(Math.random() * availCols.length)];
    for (var r = ROWS - 1; r >= 0; r--) { if (state.grid[r][col] === 0) { targetRow = r; break; } }
    if (targetRow === -1) continue;
    state.grid[targetRow][col] = value;
    state.dropCells[targetRow + ',' + col] = 'start';
    placed.push({ row: targetRow, col: col });
  }
  if (placed.length === 0) return 0;
  for (var p = 0; p < placed.length; p++) processMerges(placed[p].row, placed[p].col);
  applyGravity();
  while (scanAndMerge()) applyGravity();
  return mc;
}

function runWave(callback, speed) {
  var spd = speed || 1;
  audio.playDrop();
  var hasMerge = false;
  for (var k in state.mergeCells) { hasMerge = true; break; }
  if (hasMerge) audio.playMerge();
  scheduleAction(Math.floor(50 / spd), function() {
    for (var k in state.dropCells) state.dropCells[k] = 'fall';
  });
  scheduleAction(Math.floor(350 / spd), function() {
    state.dropCells = {}; state.mergeCells = {};
    if (callback) callback();
  });
}

// ─── Bonuses ───────────────────────────────────────────────

function chainBonuses(mergeCount) {
  var bonus = getBonusCount(mergeCount);
  if (bonus === 0 || state.gameOver) return;
  if (Math.random() < 0.2) { triggerSurprise(mergeCount); return; }
  var newMerges = spawnBonuses(bonus);
  var hasDrops = false;
  for (var k in state.dropCells) { hasDrops = true; break; }
  if (!hasDrops) return;
  state.gameOver = isBoardFull();
  showCelebration(getCelebration(mergeCount), 1500);
  runWave(function() { chainBonuses(newMerges); });
}

function triggerSurprise(mergeCount) {
  var r = Math.random();
  if (r < 0.25) {
    for (var row = 0; row < ROWS; row++)
      for (var col = 0; col < COLS; col++)
        if (state.grid[row][col] === 0) state.grid[row][col] = 2;
    state.mergeCells = {};
    applyGravity(); while (scanAndMerge()) applyGravity();
    state.gameOver = isBoardFull();
    showCelebration('惊喜！填满2', 2000);
  } else if (r < 0.5) {
    var minVal = Infinity, secondMin = Infinity;
    for (var row = 0; row < ROWS; row++) {
      for (var col = 0; col < COLS; col++) {
        if (v > 0 && v < minVal) { secondMin = minVal; minVal = v; }
        else if (v > minVal && v < secondMin) secondMin = v;
      }
    }
    if (secondMin === Infinity) secondMin = minVal * 2;
    for (var row2 = 0; row2 < ROWS; row2++)
      for (var col2 = 0; col2 < COLS; col2++)
        if (state.grid[row2][col2] === minVal) state.grid[row2][col2] = secondMin;
    showCelebration('惊喜！数字升级', 2000);
  } else if (r < 0.75) {
    var startCol = Math.floor(Math.random() * (COLS - 2));
    state.dropCells = {}; state.mergeCells = {};
    for (var ci = startCol; ci < startCol + 3; ci++) {
      for (var ri = 0; ri < 5; ri++) {
        if (state.grid[0][ci] !== 0) break;
        var val = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
        var tr = -1;
        for (var rr = ROWS - 1; rr >= 0; rr--) if (state.grid[rr][ci] === 0) { tr = rr; break; }
        if (tr === -1) break;
        state.grid[tr][ci] = val; state.dropCells[tr + ',' + ci] = 'start';
      }
    }
    state.gameOver = isBoardFull();
    showCelebration('惊喜！数字雨', 2000);
    runWave(function() {});
  } else {
    for (var row3 = 0; row3 < ROWS; row3++)
      for (var col3 = 0; col3 < COLS; col3++)
        state.grid[row3][col3] = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
    state.gameOver = isBoardFull();
    showCelebration('惊喜！全部填满', 2000);
  }
}

// ─── Power-ups ─────────────────────────────────────────────

function selectPower(type) {
  if (state.gameOver) return;
  var countField = type + 'Count';
  if (state[countField] <= 0) return;
  if (state.activePower === type) {
    state.activePower = ''; state.hintText = '点击下方列放入数字'; state.swapCell = null; return;
  }
  state.swapCell = null;
  if (type === 'wand') { state.activePower = 'wand'; state.hintText = '点击要变换的数字'; }
  else if (type === 'swap') { state.activePower = 'swap'; state.hintText = '点击第一个数字'; }
  else if (type === 'clear') { state.activePower = 'clear'; state.hintText = '点击要消除的数字'; }
  else if (type === 'supremeWand') { state.activePower = 'supremeWand'; state.hintText = '点击数字，全部相同的都会变'; }
  else if (type === 'dragonHand') triggerDragonHand();
  else if (type === 'immortal') triggerImmortal();
}

function handlePowerTap(row, col) {
  var power = state.activePower;
  if (power === 'wand') {
    if (value === 0) return;
    state.grid[row][col] = WAND_VALUES[Math.floor(Math.random() * WAND_VALUES.length)];
    state.wandCount--; if (state.wandCount <= 0) state.activePower = '';
    state.hintText = state.wandCount > 0 ? '点击要变换的数字' : '点击下方列放入数字';
  } else if (power === 'swap') {
    if (value === 0) return;
    if (!state.swapCell) { state.swapCell = { row: row, col: col }; state.hintText = '点击要交换的另一个数字'; }
    else {
      var sr = state.swapCell.row, sc = state.swapCell.col;
      if (sr === row && sc === col) { state.swapCell = null; state.hintText = '点击第一个数字'; return; }
      var tmp = state.grid[sr][sc]; state.grid[sr][sc] = state.grid[row][col]; state.grid[row][col] = tmp;
      applyGravity();
      do { mergedLoop(); } while (mergedLoop());
      state.swapCount--; state.swapCell = null;
      state.activePower = state.swapCount > 0 ? 'swap' : '';
      state.hintText = state.swapCount > 0 ? '点击第一个数字' : '点击下方列放入数字';
    }
  } else if (power === 'clear') {
    if (value === 0) return;
    state.grid[row][col] = 0; applyGravity();
    do { mergedLoop(); } while (mergedLoop());
    state.clearCount--;
    state.activePower = state.clearCount > 0 ? 'clear' : '';
    state.hintText = state.clearCount > 0 ? '点击要消除的数字' : '点击下方列放入数字';
  } else if (power === 'supremeWand') {
    if (value === 0) return;
    var opts = [value * 2, value * 4, value * 8, value * 16, value * 32];
    state.supremePicker = { base: value, options: opts, row: row, col: col };
    state.activePower = ''; state.hintText = '选择要变成的数字';
  }
}

function mergedLoop() {
  for (var mr = 0; mr < ROWS; mr++) {
    for (var mc = 0; mc < COLS; mc++) {
      var mv = state.grid[mr][mc]; if (mv === 0) continue;
      if (mr + 1 < ROWS && state.grid[mr + 1][mc] === mv) {
        state.grid[mr][mc] = mv * 2; state.grid[mr + 1][mc] = 0; state.score += mv * 2; merged = true;
      }
      if (mc + 1 < COLS && state.grid[mr][mc + 1] === mv) {
        state.grid[mr][mc] = mv * 2; state.grid[mr][mc + 1] = 0; state.score += mv * 2; merged = true;
      }
    }
  }
  if (merged) applyGravity();
  return merged;
}

function handleSupremeTap(row, col) {
  var picker = state.supremePicker;
  if (value === 0) return;
  if (picker.row === row && picker.col === col) {
    state.supremePicker = null;
    state.activePower = state.supremeWandCount > 0 ? 'supremeWand' : '';
    state.hintText = '点击数字，全部相同的都会变'; return;
  }
  state.supremePicker = { base: value, options: opts, row: row, col: col };
}

function onSupremePick(newVal) {
  var base = picker.base;
  for (var r = 0; r < ROWS; r++)
    for (var c = 0; c < COLS; c++)
      if (state.grid[r][c] === base) state.grid[r][c] = newVal;
  applyGravity();
  do { mergedLoop(); } while (mergedLoop());
  state.supremeWandCount--; state.supremePicker = null;
  state.hintText = '点击下方列放入数字';
  showCelebration('至尊魔法棒！', 2000);
}

function onCancelSupreme() {
  state.supremePicker = null;
  state.activePower = state.supremeWandCount > 0 ? 'supremeWand' : '';
  state.hintText = '点击数字，全部相同的都会变';
}

// ─── Dragon Hand ────────────────────────────────────────────

function triggerDragonHand() {
  if (state.dragonHandCount <= 0 || state.gameOver) return;
  state.dragonHandCount--; state.activePower = ''; state.hintText = '点击下方列放入数字';
  showCelebration('龙王的手！', 3000); state._dragonDrops = 20;
  doDragonWave();
}

function doDragonWave() {
  if (state._dragonDrops <= 0 || state.gameOver) return;
  var count = 2 + Math.floor(Math.random() * 2);
  if (count > state._dragonDrops) count = state._dragonDrops;
  state._dragonDrops -= count;
  state.dropCells = {}; state.mergeCells = {};
  for (var i = 0; i < count; i++) {
    var topMin = Infinity;
    for (var c = 0; c < COLS; c++)
      for (var r = 0; r < ROWS; r++)
        if (state.grid[r][c] > 0) { if (state.grid[r][c] < topMin) topMin = state.grid[r][c]; break; }
    if (topMin !== Infinity && value > topMin) value = topMin;
    var matchCols = [], nextCols = [];
    for (var c = 0; c < COLS; c++) {
      if (state.grid[0][c] !== 0) continue;
      var hasMatch = false, hasNext = false;
      for (var r = 0; r < ROWS; r++) {
        if (state.grid[r][c] === value) hasMatch = true;
        if (state.grid[r][c] === value * 2) hasNext = true;
      }
      if (hasMatch) matchCols.push(c); else if (hasNext) nextCols.push(c);
    }
    var targetCols = matchCols.length > 0 ? matchCols : (nextCols.length > 0 ? nextCols : []);
    if (targetCols.length === 0) for (var c2 = 0; c2 < COLS; c2++) if (state.grid[0][c2] === 0) targetCols.push(c2);
    if (targetCols.length === 0) return;
    for (var rr = ROWS - 1; rr >= 0; rr--) if (state.grid[rr][col] === 0) { targetRow = rr; break; }
    if (targetRow === -1) continue;
    state.grid[targetRow][col] = value; state.dropCells[targetRow + ',' + col] = 'start';
  }
  state.gameOver = isBoardFull();
  runWave(function() {
    var placedKeys = []; for (var k in state.dropCells) placedKeys.push(k);
    state.mergeCells = {};
    for (var p = 0; p < placedKeys.length; p++) {
      var parts = placedKeys[p].split(','); processMerges(parseInt(parts[0]), parseInt(parts[1]));
    }
    applyGravity(); while (scanAndMerge()) applyGravity(); applyGravity();
    var hm = false; for (var k in state.mergeCells) { hm = true; break; }
    if (hm) audio.playMerge();
    doDragonWave();
  }, 3);
}

// ─── Immortal ───────────────────────────────────────────────

function triggerImmortal() {
  if (state.immortalCount <= 0 || state.gameOver) return;
  state.immortalCount--; state.activePower = ''; state.hintText = '点击下方列放入数字';
  showCelebration('绝世仙尊！', 3000);
  state.dropCells = {}; state.mergeCells = {};
  for (var r = 0; r < ROWS; r++)
    for (var c = 0; c < COLS; c++) {
      state.grid[r][c] = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
      state.dropCells[r + ',' + c] = 'start';
    }
  runWave(function() { immortalMerge(); });
}

function immortalMerge() {
  applyGravity(); state.mergeCells = {};
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      if (r + 1 < ROWS && state.grid[r + 1][c] === v) {
        state.grid[r][c] = v * 2; state.grid[r + 1][c] = 0; state.score += v * 2;
        state.mergeCells[r + ',' + c] = true; merged = true;
      }
      if (c + 1 < COLS && state.grid[r][c + 1] === v) {
        state.grid[r][c] = v * 2; state.grid[r][c + 1] = 0; state.score += v * 2;
        state.mergeCells[r + ',' + c] = true; merged = true;
      }
    }
  }
  if (!merged) { state.gameOver = isBoardFull(); return; }
  audio.playMerge();
  scheduleAction(200, function() { immortalMerge(); });
}

// ─── Menu ──────────────────────────────────────────────────

function toggleMenu() { state.showMenu = !state.showMenu; }
function closeMenu() { state.showMenu = false; }
function restartGame() {
  state.showMenu = false; initState(); state.currentNumber = generateNumber();
}



var _ctx = null, _sw = 0, _sh = 0, _sc = 1;

function initRenderer(ctx, screenW, screenH) {
  _ctx = ctx; _sw = screenW; _sh = screenH; _sc = screenW / DESIGN_W;
}

// ─── Helpers ──────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function fillCellBg(ctx, x, y, w, h, value) {
  ctx.fillStyle = CELL_COLORS[value] || CELL_COLORS[0];
  roundRect(ctx, x, y, w, h, 8 * _sc); ctx.fill();
}

function drawCellText(ctx, x, y, w, h, value) {
  if (value <= 0) return;
  ctx.fillStyle = getTextColor(value);
  ctx.font = 'bold ' + (getFontSize(value) * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(value), x + w / 2, y + h / 2);
}

// ─── Main ─────────────────────────────────────────────────

function render() {
  ctx.clearRect(0, 0, _sw, _sh);
  ctx.fillStyle = BG_COLOR; ctx.fillRect(0, 0, _sw, _sh);
  drawHeader(); drawControlRow(); drawUpgradeRow(); drawHint();
  drawBoard(); drawCelebration(); drawGameOver(); drawMenu();
}

// ─── Header ───────────────────────────────────────────────

function drawHeader() {
  ctx.fillStyle = TITLE_COLOR;
  ctx.font = 'bold ' + (40 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('数字合成', pad, y + 10 * _sc);
  var sbW = 130 * _sc, sbH = 70 * _sc, sbX = _sw - sbW - pad;
  ctx.fillStyle = HEADER_BG; roundRect(ctx, sbX, y, sbW, sbH, 8 * _sc); ctx.fill();
  ctx.fillStyle = HEADER_TEXT;
  ctx.font = (22 * _sc) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('分数', sbX + sbW / 2, y + 12 * _sc);
  ctx.font = 'bold ' + (36 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.fillText(String(state.score), sbX + sbW / 2, y + 36 * _sc);
  var btnX = sbX - 66 * _sc, btnW = 56 * _sc, btnH = 56 * _sc;
  ctx.fillStyle = HEADER_BG; roundRect(ctx, btnX, y + 7 * _sc, btnW, btnH, 8 * _sc); ctx.fill();
  ctx.fillStyle = HEADER_TEXT;
  var barW = 32 * _sc, barH = 4 * _sc, barX = btnX + (btnW - barW) / 2;
  for (var i = 0; i < 3; i++) {
    roundRect(ctx, barX, y + 17 * _sc + i * 12 * _sc, barW, barH, 2 * _sc); ctx.fill();
  }
}

// ─── Control ──────────────────────────────────────────────

function drawControlRow() {
  if (state.supremePicker) { drawSupremePicker(); return; }
  ctx.fillStyle = TITLE_COLOR; ctx.font = (24 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('下一个数字', cx, y + 4 * _sc);
  var cellS = 90 * _sc, cellX = cx - cellS / 2, cellY = y + 30 * _sc;
  fillCellBg(ctx, cellX, cellY, cellS, cellS, state.currentNumber);
  drawCellText(ctx, cellX, cellY, cellS, cellS, state.currentNumber);
  var pw = 64 * _sc, ph = 64 * _sc, px = _sw - 30 * _sc - pw, py = y + 10 * _sc;
  var powers = ['wand', 'swap', 'clear'];
  for (var i = 0; i < powers.length; i++) {
    var bx = px - i * (pw + 8 * _sc);
    drawPowerBtn(bx, py, pw, ph, powers[i], state[powers[i] + 'Count']);
  }
}

function drawPowerBtn(x, y, w, h, type, count) {
  ctx.globalAlpha = empty ? 0.35 : 1;
  ctx.fillStyle = active ? POWER_ACTIVE_BG : '#ffffff';
  roundRect(ctx, x, y, w, h, 8 * _sc); ctx.fill();
  ctx.strokeStyle = active ? POWER_ACTIVE_BORDER : POWER_BORDER;
  ctx.lineWidth = 2 * _sc; roundRect(ctx, x, y, w, h, 8 * _sc); ctx.stroke();
  var icons = { wand: '🪄', swap: '🔄', clear: '💣' };
  ctx.fillStyle = '#333'; ctx.font = (22 * _sc) + 'px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(icons[type] || '?', x + w / 2, y + h * 0.45);
  ctx.fillStyle = '#bbada0'; ctx.font = (14 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.fillText('x' + count, x + w / 2, y + h * 0.72);
  ctx.globalAlpha = 1;
}

function drawSupremePicker() {
  ctx.fillStyle = '#bbada0'; ctx.font = (22 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(state.hintText, _sw / 2, y + 8 * _sc);
  var exitS = 50 * _sc, exitX = 20 * _sc, exitY = y + 30 * _sc;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#dddddd'; ctx.lineWidth = 2 * _sc;
  ctx.beginPath(); ctx.arc(exitX + exitS / 2, exitY + exitS / 2, exitS / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#999999'; ctx.font = (26 * _sc) + 'px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✕', exitX + exitS / 2, exitY + exitS / 2);
  for (var i = 0; i < opts.length; i++) {
    var ox = sx + i * (ow + 10 * _sc);
    fillCellBg(ctx, ox, exitY, ow, oh, opts[i]); drawCellText(ctx, ox, exitY, ow, oh, opts[i]);
  }
}

// ─── Upgrade ──────────────────────────────────────────────

function drawUpgradeRow() {
  if (state.supremePicker) return;
  var items = [
    { type: 'supremeWand', label: '至尊魔法棒' },
    { type: 'dragonHand',  label: '龙王的手' },
    { type: 'immortal',    label: '绝世仙尊' }
  ];
  var bw = 150 * _sc, bh = 46 * _sc, totalW = items.length * bw + 2 * 12 * _sc, sx = (_sw - totalW) / 2;
  for (var i = 0; i < items.length; i++) {
    var it = items[i], bx = sx + i * (bw + 12 * _sc);
    ctx.globalAlpha = empty ? 0.35 : 1;
    ctx.fillStyle = active ? POWER_ACTIVE_BG : '#ffffff';
    roundRect(ctx, bx, y, bw, bh, 20 * _sc); ctx.fill();
    ctx.strokeStyle = active ? POWER_ACTIVE_BORDER : POWER_BORDER; ctx.lineWidth = 2 * _sc;
    roundRect(ctx, bx, y, bw, bh, 20 * _sc); ctx.stroke();
    ctx.fillStyle = TITLE_COLOR; ctx.font = (22 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(it.label, bx + bw / 2, y + bh / 2); ctx.globalAlpha = 1;
  }
}

// ─── Hint ─────────────────────────────────────────────────

function drawHint() {
  ctx.fillStyle = HINT_COLOR; ctx.font = (22 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(state.hintText, _sw / 2, y + 4 * _sc);
}

// ─── Board ────────────────────────────────────────────────

function drawBoard() {
  var cellW = CELL_W * _sc, cellH = CELL_H * _sc, gap = GAP * _sc, rowH = ROW_H * _sc;
  var totalBoardW = COLS * cellW + (COLS - 1) * gap, boardLeft = (_sw - totalBoardW) / 2;
  var totalH = ROWS * rowH, visibleH = _sh - BOARD_TOP * _sc;
  state.maxScrollY = Math.max(0, totalH - visibleH);
  ctx.save(); ctx.beginPath(); ctx.rect(0, BOARD_TOP * _sc, _sw, visibleH); ctx.clip();
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var cx = boardLeft + c * (cellW + gap), cy = boardTop + r * rowH;
      if (cy + cellH < BOARD_TOP * _sc || cy > _sh) continue;
      var key = r + ',' + c, phase = state.dropCells[key], offsetY = 0;
      if (phase === 'start') offsetY = -(r * ROW_H + 150) * _sc;
      drawCell(cx, cy + offsetY, cellW, cellH, state.grid[r][c], r, c);
    }
  }
  ctx.restore();
}

function drawCell(x, y, w, h, value, row, col) {
  fillCellBg(ctx, x, y, w, h, value);
  var hl = (state.swapCell && state.swapCell.row === row && state.swapCell.col === col) ||
           (state.supremePicker && state.supremePicker.row === row && state.supremePicker.col === col);
  if (hl) {
    ctx.save(); ctx.strokeStyle = SWAP_GLOW; ctx.lineWidth = 4 * _sc;
    ctx.shadowColor = SWAP_GLOW; ctx.shadowBlur = 12 * _sc;
    roundRect(ctx, x, y, w, h, 8 * _sc); ctx.stroke(); ctx.restore();
  }
  drawCellText(ctx, x, y, w, h, value);
}

// ─── Celebration ──────────────────────────────────────────

function drawCelebration() {
  if (!state.celebration) return;
  var elapsed = Date.now() - state.celebTime;
  ctx.save(); ctx.globalAlpha = t.alpha; ctx.translate(_sw / 2, _sh / 2); ctx.scale(t.scale, t.scale);
  ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.font = 'bold ' + (56 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(state.celebration, 2 * _sc, 2 * _sc);
  ctx.fillStyle = CELEB_COLOR;
  ctx.fillText(state.celebration, 0, 0);
  ctx.restore();
}

// ─── Game Over ────────────────────────────────────────────

function drawGameOver() {
  if (!state.gameOver) return;
  ctx.fillStyle = OVERLAY_BG; ctx.fillRect(0, 0, _sw, _sh);
  ctx.fillStyle = '#ffffff'; roundRect(ctx, bx, by, bw, bh, 12 * _sc); ctx.fill();
  ctx.fillStyle = TITLE_COLOR; ctx.font = 'bold ' + (48 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('游戏结束', _sw / 2, by + 70 * _sc);
  ctx.font = (32 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.fillText('得分: ' + state.score, _sw / 2, by + 140 * _sc);
  var btnW = 200 * _sc, btnH = 56 * _sc, btnX = (_sw - btnW) / 2, btnY = by + 190 * _sc;
  ctx.fillStyle = NEWGAME_BG; roundRect(ctx, btnX, btnY, btnW, btnH, 8 * _sc); ctx.fill();
  ctx.fillStyle = '#f9f6f2'; ctx.font = (28 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.fillText('重新开始', _sw / 2, btnY + btnH / 2);
}

// ─── Menu ─────────────────────────────────────────────────

function drawMenu() {
  if (!state.showMenu) return;
  ctx.fillStyle = 'rgba(0,0,0,0.01)'; ctx.fillRect(0, 0, _sw, _sh);
  var mw = 280 * _sc, mx = _sw - 30 * _sc - mw, my = 100 * _sc, itemH = 56 * _sc;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 24 * _sc; ctx.shadowOffsetY = 6 * _sc;
  ctx.fillStyle = MENU_BG; roundRect(ctx, mx, my, mw, itemH * 4, 10 * _sc); ctx.fill(); ctx.restore();
  for (var i = 0; i < items.length; i++) {
    var iy = my + i * itemH, item = items[i];
    ctx.fillStyle = TITLE_COLOR; ctx.font = (28 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(item.label, mx + 30 * _sc, iy + itemH / 2);
    if (item.type === 'sfx' || item.type === 'bgm') {
      var on = item.type === 'sfx' ? audio.sfxEnabled : audio.bgmEnabled;
      drawToggle(mx + mw - 90 * _sc, iy + (itemH - 36 * _sc) / 2, on);
    }
    if (i === 2) {
      ctx.strokeStyle = '#e8e0d8'; ctx.lineWidth = 1 * _sc;
      ctx.beginPath(); ctx.moveTo(mx + 30 * _sc, iy); ctx.lineTo(mx + mw - 30 * _sc, iy); ctx.stroke();
    }
  }
}

function drawToggle(x, y, on) {
  ctx.fillStyle = on ? TOGGLE_ON_BG : TOGGLE_OFF_BG; roundRect(ctx, x, y, tw, th, 18 * _sc); ctx.fill();
  var kx = on ? x + tw - 4 * _sc - kr * 2 : x + 4 * _sc;
  ctx.fillStyle = '#ffffff'; ctx.beginPath();
  ctx.arc(kx + kr, y + (th - kr * 2) / 2 + kr, kr, 0, Math.PI * 2); ctx.fill();
}


var _sw = 0, _sc = 1;
var _touchStartX = 0, _touchStartY = 0, _touchStartTime = 0;
var _isScrolling = false, _scrollBaseY = 0, _lastDy = 0, _lastTime = 0;

function initInput(screenW) {
  _sw = screenW; _sc = screenW / DESIGN_W;

  wx.onTouchStart(function(e) {
    _touchStartX = t.clientX; _touchStartY = t.clientY; _touchStartTime = Date.now();
    _isScrolling = false; _scrollBaseY = state.scrollY; _lastDy = 0; _lastTime = _touchStartTime;
  });

  wx.onTouchMove(function(e) {
    if (!_isScrolling && Math.abs(dy) > 8 && Math.abs(_touchStartX - t.clientX) < Math.abs(dy) * 2) _isScrolling = true;
    if (_isScrolling) {
      state.scrollY = _scrollBaseY + dy;
      if (state.scrollY < 0) state.scrollY = 0;
      if (state.scrollY > state.maxScrollY) state.scrollY = state.maxScrollY;
      _lastDy = t.clientY - _touchStartY; _lastTime = Date.now();
    }
  });

  wx.onTouchEnd(function(e) {
    if (_isScrolling) {
      var dt = Date.now() - _lastTime;
      if (dt > 0 && dt < 100) state.scrollVelocity = -_lastDy / dt * 16;
      return;
    }
    if (Date.now() - _touchStartTime > 300) return;
    hitTest(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  });
}

function hitTest(x, y) {
  if (state.gameOver) { restartGame(); return; }
  if (state.showMenu) {
    var mh = hitMenu(x, y);
    if (mh) { handleMenuHit(mh); return; }
    state.showMenu = false; return;
  }
  if (state.supremePicker) {
    var pv = hitSupremePicker(x, y);
    if (pv === 'exit') { onCancelSupreme(); return; }
    if (pv > 0) { onSupremePick(pv); return; }
  }
  if (hitMenuBtn(x, y)) { toggleMenu(); return; }
  var up = hitUpgradeBtn(x, y); if (up) { selectPower(up); return; }
  var cell = hitCell(x, y);
  if (cell) { handleCellTap(cell.row, cell.col); return; }
}

function hitMenuBtn(x, y) {
  return x >= bx && x <= bx + 56 * _sc && y >= by && y <= by + 56 * _sc;
}

function hitPowerBtn(x, y) {
  var py = HEADER_H * _sc + 10 * _sc, pw = 64 * _sc, px = _sw - 30 * _sc - pw;
  for (var i = 0; i < powers.length; i++) {
    if (x >= bx && x <= bx + pw && y >= py && y <= py + 64 * _sc) return powers[i];
  }
  return null;
}

function hitUpgradeBtn(x, y) {
  var by = (HEADER_H + CONTROL_H) * _sc, bw = 150 * _sc, bh = 46 * _sc;
  var totalW = items.length * bw + 2 * 12 * _sc, sx = (_sw - totalW) / 2;
  for (var i = 0; i < items.length; i++) {
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return items[i];
  }
  return null;
}

function hitCell(x, y) {
  var bl = (_sw - totalW) / 2, bt = BOARD_TOP * _sc - state.scrollY;
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      if (x >= cx && x <= cx + cellW && y >= cy && y <= cy + cellH) return { row: r, col: c };
    }
  }
  return null;
}

function hitSupremePicker(x, y) {
  if ((x - ecx) * (x - ecx) + (y - ecy) * (y - ecy) <= (exitS / 2) * (exitS / 2)) return 'exit';
  var ow = 90 * _sc, oh = 70 * _sc, sx = 20 * _sc + exitS + 16 * _sc;
  for (var i = 0; i < opts.length; i++) {
    if (x >= ox && x <= ox + ow && y >= py && y <= py + oh) return opts[i];
  }
  return 0;
}

function hitMenu(x, y) {
  if (x >= mx && x <= mx + mw && y >= my && y <= my + itemH * 4) {
    var idx = Math.floor((y - my) / itemH);
    if (idx === 0) return 'sfx'; if (idx === 1) return 'bgm'; if (idx === 2) return 'restart';
  }
  return null;
}

function handleMenuHit(type) {
  if (type === 'sfx') audio.toggleSfx();
  else if (type === 'bgm') audio.toggleBgm();
  else if (type === 'restart') restartGame();
}

function handleCellTap(row, col) {
  if (state.gameOver) return;
  if (state.supremePicker) { handleSupremeTap(row, col); return; }
  if (state.activePower) { handlePowerTap(row, col); return; }
  if (!placeNumber(col, state.currentNumber)) {
    if (isBoardFull()) state.gameOver = true;
    return;
  }
  state.currentNumber = generateNumber();
  state.gameOver = isBoardFull();
  runWave(function() { chainBonuses(mc); });
}


function init() {
  var sysInfo = wx.getSystemInfoSync();
  var dpr = sysInfo.pixelRatio || 2;
  var screenW = sysInfo.windowWidth;
  var screenH = sysInfo.windowHeight;

  var canvas = wx.createCanvas();
  canvas.width = screenW * dpr;
  canvas.height = screenH * dpr;

  ctx.scale(dpr, dpr);

  initState();
  audio.init();
  initRenderer(ctx, screenW, screenH);
  initInput(screenW);
  state.currentNumber = generateNumber();

  wx.onShow(function() { if (audio.bgmEnabled) audio.playBgm(); });
  wx.onHide(function() { audio.pauseBgm(); });

  requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
  var now = timestamp || Date.now();
  updateAnim(now);
  processActions(now);
  updateScrollInertia();
  render();
  requestAnimationFrame(gameLoop);
}


init();