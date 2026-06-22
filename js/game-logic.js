// ─── Bonus helpers ────────────────────────────────────────────
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

// ─── Core mechanics ────────────────────────────────────────────

function isBoardFull() {
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      if (state.grid[r][c] === 0) return false;
    }
  }
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

  while (scanAndMerge()) {
    applyGravity();
  }

  return true;
}

function processMerges(row, col) {
  var value = state.grid[row][col];
  if (value === 0) return;

  var dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]];

  for (var d = 0; d < dirs.length; d++) {
    var nr = row + dirs[d][0];
    var nc = col + dirs[d][1];
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
        if (r !== w) {
          state.grid[w][c] = state.grid[r][c];
          state.grid[r][c] = 0;
        }
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
        state.grid[r][c] = v * 2;
        state.grid[r + 1][c] = 0;
        state.score += v * 2;
        state.mergeCells[r + ',' + c] = true;
        merged = true;
      }
      if (c + 1 < COLS && state.grid[r][c + 1] === v) {
        if (c + 1 === state._activeCol) {
          state.grid[r][c + 1] = v * 2;
          state.grid[r][c] = 0;
          state.score += v * 2;
          state.mergeCells[r + ',' + (c + 1)] = true;
        } else {
          state.grid[r][c] = v * 2;
          state.grid[r][c + 1] = 0;
          state.score += v * 2;
          state.mergeCells[r + ',' + c] = true;
        }
        merged = true;
      }
    }
  }
  return merged;
}

function spawnBonuses(count) {
  state.dropCells = {};
  state.mergeCells = {};

  var placed = [];
  for (var i = 0; i < count; i++) {
    var availCols = [];
    for (var c = 0; c < COLS; c++) {
      if (state.grid[0][c] === 0) availCols.push(c);
    }
    if (availCols.length === 0) break;

    var col = availCols[Math.floor(Math.random() * availCols.length)];
    var value = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];

    var targetRow = -1;
    for (var r = ROWS - 1; r >= 0; r--) {
      if (state.grid[r][col] === 0) { targetRow = r; break; }
    }
    if (targetRow === -1) continue;

    state.grid[targetRow][col] = value;
    state.dropCells[targetRow + ',' + col] = 'start';
    placed.push({ row: targetRow, col: col });
  }

  if (placed.length === 0) return 0;

  for (var p = 0; p < placed.length; p++) {
    processMerges(placed[p].row, placed[p].col);
  }
  applyGravity();

  while (scanAndMerge()) {
    applyGravity();
  }

  var mc = 0;
  for (var k in state.mergeCells) mc++;
  return mc;
}

// ─── Animation wave ────────────────────────────────────────────

function runWave(callback, speed) {
  var spd = speed || 1;
  audio.playDrop();

  var hasMerge = false;
  for (var k in state.mergeCells) { hasMerge = true; break; }
  if (hasMerge) audio.playMerge();

  // Phase 1: drop cells in start position (renderer reads state.dropCells)

  // Phase 2: transition to fall
  scheduleAction(Math.floor(50 / spd), function() {
    for (var k in state.dropCells) {
      state.dropCells[k] = 'fall';
    }
  });

  // Phase 3: clean up
  scheduleAction(Math.floor(350 / spd), function() {
    state.dropCells = {};
    state.mergeCells = {};
    if (callback) callback();
  });
}

// ─── Chain bonuses + surprise ──────────────────────────────────

function chainBonuses(mergeCount) {
  var bonus = getBonusCount(mergeCount);
  if (bonus === 0 || state.gameOver) return;

  if (Math.random() < 0.2) {
    triggerSurprise(mergeCount);
    return;
  }

  var newMerges = spawnBonuses(bonus);
  var hasDrops = false;
  for (var k in state.dropCells) { hasDrops = true; break; }
  if (!hasDrops) return;

  state.gameOver = isBoardFull();

  var text = getCelebration(mergeCount);
  state.celebration = text;
  state.celebTime = Date.now();
  addTween('celebration', null, 900);
  scheduleAction(1500, function() {
    state.celebration = '';
  });

  runWave(function() {
    chainBonuses(newMerges);
  });
}

function triggerSurprise(mergeCount) {
  var r = Math.random();

  if (r < 0.25) {
    // Fill all empty cells with 2
    for (var row = 0; row < ROWS; row++) {
      for (var col = 0; col < COLS; col++) {
        if (state.grid[row][col] === 0) state.grid[row][col] = 2;
      }
    }
    state.mergeCells = {};
    applyGravity();
    while (scanAndMerge()) { applyGravity(); }
    state.gameOver = isBoardFull();
    showCelebration('惊喜！填满2', 2000);

  } else if (r < 0.5) {
    // Smallest number becomes second smallest
    var minVal = Infinity, secondMin = Infinity;
    for (var row = 0; row < ROWS; row++) {
      for (var col = 0; col < COLS; col++) {
        var v = state.grid[row][col];
        if (v > 0 && v < minVal) { secondMin = minVal; minVal = v; }
        else if (v > minVal && v < secondMin) { secondMin = v; }
      }
    }
    if (secondMin === Infinity) secondMin = minVal * 2;
    for (var row2 = 0; row2 < ROWS; row2++) {
      for (var col2 = 0; col2 < COLS; col2++) {
        if (state.grid[row2][col2] === minVal) state.grid[row2][col2] = secondMin;
      }
    }
    showCelebration('惊喜！数字升级', 2000);

  } else if (r < 0.75) {
    // 3 consecutive columns get 5 random drops each
    var startCol = Math.floor(Math.random() * (COLS - 2));
    state.dropCells = {};
    state.mergeCells = {};
    for (var ci = startCol; ci < startCol + 3; ci++) {
      for (var ri = 0; ri < 5; ri++) {
        if (state.grid[0][ci] !== 0) break;
        var val = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
        var tr = -1;
        for (var rr = ROWS - 1; rr >= 0; rr--) {
          if (state.grid[rr][ci] === 0) { tr = rr; break; }
        }
        if (tr === -1) break;
        state.grid[tr][ci] = val;
        state.dropCells[tr + ',' + ci] = 'start';
      }
    }
    state.gameOver = isBoardFull();
    showCelebration('惊喜！数字雨', 2000);
    runWave(function() {});

  } else {
    // Fill all cells with random numbers
    for (var row3 = 0; row3 < ROWS; row3++) {
      for (var col3 = 0; col3 < COLS; col3++) {
        state.grid[row3][col3] = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
      }
    }
    state.gameOver = isBoardFull();
    showCelebration('惊喜！全部填满', 2000);
  }
}

function showCelebration(text, duration) {
  state.celebration = text;
  state.celebTime = Date.now();
  addTween('celebration', null, 900);
  scheduleAction(duration, function() {
    state.celebration = '';
  });
}

// ─── Power-ups ─────────────────────────────────────────────────

function selectPower(type) {
  if (state.gameOver) return;

  var countField = type + 'Count';
  if (state[countField] <= 0) return;

  // Toggle off if already active
  if (state.activePower === type) {
    state.activePower = '';
    state.hintText = '点击下方列放入数字';
    state.swapCell = null;
    return;
  }

  state.swapCell = null;

  if (type === 'wand') {
    state.activePower = 'wand';
    state.hintText = '点击要变换的数字';
  } else if (type === 'swap') {
    state.activePower = 'swap';
    state.hintText = '点击第一个数字';
  } else if (type === 'clear') {
    state.activePower = 'clear';
    state.hintText = '点击要消除的数字';
  } else if (type === 'supremeWand') {
    state.activePower = 'supremeWand';
    state.hintText = '点击数字，全部相同的都会变';
  } else if (type === 'dragonHand') {
    triggerDragonHand();
  } else if (type === 'immortal') {
    triggerImmortal();
  }
}

function handlePowerTap(row, col) {
  var power = state.activePower;
  var value = state.grid[row][col];

  if (power === 'wand') {
    if (value === 0) return;
    state.grid[row][col] = WAND_VALUES[Math.floor(Math.random() * WAND_VALUES.length)];
    state.wandCount--;
    if (state.wandCount <= 0) state.activePower = '';
    state.hintText = state.wandCount > 0 ? '点击要变换的数字' : '点击下方列放入数字';

  } else if (power === 'swap') {
    if (value === 0) return;
    if (!state.swapCell) {
      state.swapCell = { row: row, col: col };
      state.hintText = '点击要交换的另一个数字';
    } else {
      var sr = state.swapCell.row;
      var sc = state.swapCell.col;
      if (sr === row && sc === col) {
        state.swapCell = null;
        state.hintText = '点击第一个数字';
        return;
      }
      var tmp = state.grid[sr][sc];
      state.grid[sr][sc] = state.grid[row][col];
      state.grid[row][col] = tmp;

      applyGravity();
      var merged = false;
      do {
        merged = false;
        for (var mr = 0; mr < ROWS; mr++) {
          for (var mc = 0; mc < COLS; mc++) {
            var mv = state.grid[mr][mc];
            if (mv === 0) continue;
            if (mr + 1 < ROWS && state.grid[mr + 1][mc] === mv) {
              state.grid[mr][mc] = mv * 2; state.grid[mr + 1][mc] = 0; state.score += mv * 2; merged = true;
            }
            if (mc + 1 < COLS && state.grid[mr][mc + 1] === mv) {
              state.grid[mr][mc] = mv * 2; state.grid[mr][mc + 1] = 0; state.score += mv * 2; merged = true;
            }
          }
        }
        if (merged) applyGravity();
      } while (merged);

      state.swapCount--;
      state.swapCell = null;
      state.activePower = state.swapCount > 0 ? 'swap' : '';
      state.hintText = state.swapCount > 0 ? '点击第一个数字' : '点击下方列放入数字';
    }

  } else if (power === 'clear') {
    if (value === 0) return;
    state.grid[row][col] = 0;
    applyGravity();
    var merged = false;
    do {
      merged = false;
      for (var mr = 0; mr < ROWS; mr++) {
        for (var mc = 0; mc < COLS; mc++) {
          var mv = state.grid[mr][mc];
          if (mv === 0) continue;
          if (mr + 1 < ROWS && state.grid[mr + 1][mc] === mv) {
            state.grid[mr][mc] = mv * 2; state.grid[mr + 1][mc] = 0; state.score += mv * 2; merged = true;
          }
          if (mc + 1 < COLS && state.grid[mr][mc + 1] === mv) {
            state.grid[mr][mc] = mv * 2; state.grid[mr][mc + 1] = 0; state.score += mv * 2; merged = true;
          }
        }
      }
      if (merged) applyGravity();
    } while (merged);

    state.clearCount--;
    state.activePower = state.clearCount > 0 ? 'clear' : '';
    state.hintText = state.clearCount > 0 ? '点击要消除的数字' : '点击下方列放入数字';

  } else if (power === 'supremeWand') {
    if (value === 0) return;
    var opts = [value * 2, value * 4, value * 8, value * 16, value * 32];
    state.supremePicker = { base: value, options: opts, row: row, col: col };
    state.activePower = '';
    state.hintText = '选择要变成的数字';
  }
}

function handleSupremeTap(row, col) {
  var picker = state.supremePicker;
  var value = state.grid[row][col];
  if (value === 0) return;

  if (picker.row === row && picker.col === col) {
    state.supremePicker = null;
    state.activePower = state.supremeWandCount > 0 ? 'supremeWand' : '';
    state.hintText = '点击数字，全部相同的都会变';
    return;
  }

  var opts = [value * 2, value * 4, value * 8, value * 16, value * 32];
  state.supremePicker = { base: value, options: opts, row: row, col: col };
}

function onSupremePick(newVal) {
  var picker = state.supremePicker;
  if (!picker) return;
  var base = picker.base;

  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      if (state.grid[r][c] === base) state.grid[r][c] = newVal;
    }
  }

  applyGravity();
  var merged = false;
  do {
    merged = false;
    for (var mr = 0; mr < ROWS; mr++) {
      for (var mc = 0; mc < COLS; mc++) {
        var mv = state.grid[mr][mc];
        if (mv === 0) continue;
        if (mr + 1 < ROWS && state.grid[mr + 1][mc] === mv) {
          state.grid[mr][mc] = mv * 2; state.grid[mr + 1][mc] = 0; state.score += mv * 2; merged = true;
        }
        if (mc + 1 < COLS && state.grid[mr][mc + 1] === mv) {
          state.grid[mr][mc] = mv * 2; state.grid[mr][mc + 1] = 0; state.score += mv * 2; merged = true;
        }
      }
    }
    if (merged) applyGravity();
  } while (merged);

  state.supremeWandCount--;
  state.supremePicker = null;
  state.hintText = '点击下方列放入数字';
  showCelebration('至尊魔法棒！', 2000);
}

function onCancelSupreme() {
  state.supremePicker = null;
  state.activePower = state.supremeWandCount > 0 ? 'supremeWand' : '';
  state.hintText = '点击数字，全部相同的都会变';
}

// ─── Dragon Hand ───────────────────────────────────────────────

function triggerDragonHand() {
  if (state.dragonHandCount <= 0 || state.gameOver) return;
  state.dragonHandCount--;
  state.activePower = '';
  state.hintText = '点击下方列放入数字';
  showCelebration('龙王的手！', 3000);
  state._dragonDrops = 20;
  doDragonWave();
}

function doDragonWave() {
  if (state._dragonDrops <= 0 || state.gameOver) return;

  var count = 2 + Math.floor(Math.random() * 2);
  if (count > state._dragonDrops) count = state._dragonDrops;
  state._dragonDrops -= count;

  state.dropCells = {};
  state.mergeCells = {};

  for (var i = 0; i < count; i++) {
    var topMin = Infinity;
    for (var c = 0; c < COLS; c++) {
      for (var r = 0; r < ROWS; r++) {
        if (state.grid[r][c] > 0) {
          if (state.grid[r][c] < topMin) topMin = state.grid[r][c];
          break;
        }
      }
    }

    var value = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
    if (topMin !== Infinity && value > topMin) value = topMin;

    var matchCols = [];
    var nextCols = [];
    for (var c = 0; c < COLS; c++) {
      if (state.grid[0][c] !== 0) continue;
      var hasMatch = false, hasNext = false;
      for (var r = 0; r < ROWS; r++) {
        if (state.grid[r][c] === value) hasMatch = true;
        if (state.grid[r][c] === value * 2) hasNext = true;
      }
      if (hasMatch) matchCols.push(c);
      else if (hasNext) nextCols.push(c);
    }

    var targetCols = matchCols.length > 0 ? matchCols : (nextCols.length > 0 ? nextCols : []);
    if (targetCols.length === 0) {
      for (var c2 = 0; c2 < COLS; c2++) {
        if (state.grid[0][c2] === 0) targetCols.push(c2);
      }
    }
    if (targetCols.length === 0) return;

    var col = targetCols[Math.floor(Math.random() * targetCols.length)];
    var targetRow = -1;
    for (var rr = ROWS - 1; rr >= 0; rr--) {
      if (state.grid[rr][col] === 0) { targetRow = rr; break; }
    }
    if (targetRow === -1) continue;

    state.grid[targetRow][col] = value;
    state.dropCells[targetRow + ',' + col] = 'start';
  }

  state.gameOver = isBoardFull();

  runWave(function() {
    var placedKeys = [];
    for (var k in state.dropCells) placedKeys.push(k);
    state.mergeCells = {};
    for (var p = 0; p < placedKeys.length; p++) {
      var parts = placedKeys[p].split(',');
      processMerges(parseInt(parts[0]), parseInt(parts[1]));
    }
    applyGravity();
    while (scanAndMerge()) { applyGravity(); }
    applyGravity();

    var hasMerge = false;
    for (var k in state.mergeCells) { hasMerge = true; break; }
    if (hasMerge) audio.playMerge();

    doDragonWave();
  }, 3);
}

// ─── Immortal ──────────────────────────────────────────────────

function triggerImmortal() {
  if (state.immortalCount <= 0 || state.gameOver) return;
  state.immortalCount--;
  state.activePower = '';
  state.hintText = '点击下方列放入数字';
  showCelebration('绝世仙尊！', 3000);

  state.dropCells = {};
  state.mergeCells = {};
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      state.grid[r][c] = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
      state.dropCells[r + ',' + c] = 'start';
    }
  }

  runWave(function() {
    immortalMerge();
  });
}

function immortalMerge() {
  applyGravity();
  state.mergeCells = {};
  var merged = false;

  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var v = state.grid[r][c];
      if (v === 0) continue;
      if (r + 1 < ROWS && state.grid[r + 1][c] === v) {
        state.grid[r][c] = v * 2; state.grid[r + 1][c] = 0; state.score += v * 2; state.mergeCells[r + ',' + c] = true; merged = true;
      }
      if (c + 1 < COLS && state.grid[r][c + 1] === v) {
        state.grid[r][c] = v * 2; state.grid[r][c + 1] = 0; state.score += v * 2; state.mergeCells[r + ',' + c] = true; merged = true;
      }
    }
  }

  if (!merged) {
    state.gameOver = isBoardFull();
    return;
  }

  audio.playMerge();
  scheduleAction(200, function() {
    immortalMerge();
  });
}

// ─── Menu actions ──────────────────────────────────────────────

function toggleMenu() {
  state.showMenu = !state.showMenu;
  if (state.showMenu) state._scrollStartY = state.scrollY;
}

function closeMenu() {
  state.showMenu = false;
}

function restartGame() {
  state.showMenu = false;
  initState();
  state.currentNumber = generateNumber();
}
