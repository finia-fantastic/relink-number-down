var ROWS = 11;
var COLS = 6;
var CELL_H = 90;
var GAP = 6;
var ROW_H = CELL_H + GAP;
var SPAWN_VALUES = [2, 4, 8, 16, 32];
var WAND_VALUES = [2, 4, 8, 16, 32, 64];

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

var audio = null;
function getAudio() {
  if (!audio) {
    try {
      audio = require('../../utils/audio');
    } catch (e) {
      audio = { sfxEnabled: true, bgmEnabled: false, playBgm: function(){}, playDrop: function(){}, playMerge: function(){}, toggleSfx: function(){ return true; }, toggleBgm: function(){ return false; } };
    }
  }
  return audio;
}

Page({
  data: {
    grid: [],
    score: 0,
    currentNumber: 2,
    gameOver: false,
    showMenu: false,
    celebration: '',
    sfxEnabled: true,
    bgmEnabled: false,
    wandCount: 3,
    swapCount: 3,
    clearCount: 3,
    supremeWandCount: 1,
    dragonHandCount: 1,
    immortalCount: 1,
    activePower: '',
    hintText: '点击下方列放入数字',
    supremePicker: null,
    swapCell: null
  },

  onLoad: function() {
    this.initGame();
  },

  initGame: function() {
    var grid = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push(0);
      grid.push(row);
    }
    this.grid = grid;
    this.score = 0;
    this.gameOver = false;
    this.dropCells = {};
    this.mergeCells = {};
    this._activeCol = -1;
    clearTimeout(this._animTimer);
    this.setData({
      grid: this.buildDisplayGrid(),
      score: 0,
      currentNumber: this.generateNumber(),
      gameOver: false,
      showMenu: false,
      celebration: '',
      wandCount: 3,
      swapCount: 3,
      clearCount: 3,
      supremeWandCount: 1,
      dragonHandCount: 1,
      immortalCount: 1,
      activePower: '',
      hintText: '点击下方列放入数字',
      swapCell: null,
      supremePicker: null
    });

  },

  generateNumber: function() {
    return SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
  },

  buildDisplayGrid: function() {
    var display = [];
    for (var r = 0; r < ROWS; r++) {
      var rowData = [];
      for (var c = 0; c < COLS; c++) {
        var key = r + ',' + c;
        var phase = this.dropCells[key];
        var style = '';

        if (phase === 'start') {
          var offset = -(r * ROW_H + 150);
          style = 'transform:translateY(' + offset + 'rpx);transition:none';
        } else if (phase === 'fall') {
          style = 'transform:translateY(0);transition:transform 0.2s ease-out';
        }

        var extraClass = '';
        if (this.data.swapCell && this.data.swapCell.row === r && this.data.swapCell.col === c) {
          extraClass = 'swap-selected';
        }
        if (this.data.supremePicker && this.data.supremePicker.row === r && this.data.supremePicker.col === c) {
          extraClass = 'supreme-selected';
        }

        rowData.push({
          value: this.grid[r][c],
          style: style,
          extraClass: extraClass,
          merging: false
        });
      }
      display.push(rowData);
    }
    return display;
  },

  clearAnimations: function() {
    this.dropCells = {};
    this.mergeCells = {};
    this.setData({ grid: this.buildDisplayGrid() });
  },

  // ─── Events ──────────────────────────────────────────────────

  onTapColumn: function(e) {
    if (this.gameOver) return;

    var col = e.currentTarget.dataset.col;
    var row = e.currentTarget.dataset.row;

    // Supreme picker active — update selection or cancel
    if (this.data.supremePicker) {
      this.handleSupremeTap(row, col);
      return;
    }

    // Power-up mode
    if (this.data.activePower) {
      this.handlePowerTap(row, col);
      return;
    }

    // Normal mode: drop number
    if (!this.placeNumber(col, this.data.currentNumber)) return;

    var mergeCount = 0;
    for (var k in this.mergeCells) mergeCount++;

    this.currentNumber = this.generateNumber();
    this.gameOver = this.isBoardFull();

    var self = this;
    this.runWave(function() {
      self.chainBonuses(mergeCount);
    });
  },

  handleSupremeTap: function(row, col) {
    var picker = this.data.supremePicker;
    var value = this.grid[row][col];
    if (value === 0) return;

    // Tap same cell — cancel
    if (picker.row === row && picker.col === col) {
      this.setData({
        supremePicker: null,
        activePower: this.data.supremeWandCount > 0 ? 'supremeWand' : '',
        hintText: '点击数字，全部相同的都会变',
        grid: this.buildDisplayGrid()
      });
      return;
    }

    // Different cell — update options
    var opts = [value * 2, value * 4, value * 8, value * 16, value * 32];
    this.data.supremePicker = { base: value, options: opts, row: row, col: col };
    this.setData({
      supremePicker: { base: value, options: opts, row: row, col: col },
      grid: this.buildDisplayGrid()
    });
  },

  handlePowerTap: function(row, col) {
    var power = this.data.activePower;
    var value = this.grid[row][col];

    if (power === 'wand') {
      if (value === 0) return;
      var newVal = WAND_VALUES[Math.floor(Math.random() * WAND_VALUES.length)];
      this.grid[row][col] = newVal;
      var newCount = this.data.wandCount - 1;
      this.setData({
        grid: this.buildDisplayGrid(),
        wandCount: newCount,
        activePower: newCount > 0 ? 'wand' : '',
        hintText: newCount > 0 ? '点击要变换的数字' : '点击下方列放入数字'
      });

    } else if (power === 'swap') {
      if (value === 0) return;

      if (!this.data.swapCell) {
        this.data.swapCell = { row: row, col: col };
        this.setData({
          swapCell: { row: row, col: col },
          grid: this.buildDisplayGrid(),
          hintText: '点击要交换的另一个数字'
        });
      } else {
        var sr = this.data.swapCell.row;
        var sc = this.data.swapCell.col;
        // Same cell — deselect
        if (sr === row && sc === col) {
          this.setData({
            swapCell: null,
            grid: this.buildDisplayGrid(),
            hintText: '点击第一个数字'
          });
          return;
        }
        var tmp = this.grid[sr][sc];
        this.grid[sr][sc] = this.grid[row][col];
        this.grid[row][col] = tmp;

        // Apply gravity + merge after swap
        this.applyGravity();
        var merged = false;
        do {
          merged = false;
          for (var mr = 0; mr < ROWS; mr++) {
            for (var mc = 0; mc < COLS; mc++) {
              var mv = this.grid[mr][mc];
              if (mv === 0) continue;
              if (mr + 1 < ROWS && this.grid[mr + 1][mc] === mv) {
                this.grid[mr][mc] = mv * 2;
                this.grid[mr + 1][mc] = 0;
                this.score += mv * 2;
                merged = true;
              }
              if (mc + 1 < COLS && this.grid[mr][mc + 1] === mv) {
                this.grid[mr][mc] = mv * 2;
                this.grid[mr][mc + 1] = 0;
                this.score += mv * 2;
                merged = true;
              }
            }
          }
          if (merged) this.applyGravity();
        } while (merged);
        this.gameOver = this.isBoardFull();

        var sc2 = this.data.swapCount - 1;
        this.setData({
          grid: this.buildDisplayGrid(),
          score: this.score,
          swapCount: sc2,
          swapCell: null,
          activePower: sc2 > 0 ? 'swap' : '',
          hintText: sc2 > 0 ? '点击第一个数字' : '点击下方列放入数字',
          gameOver: this.gameOver
        });
      }

    } else if (power === 'clear') {
      if (value === 0) return;
      this.grid[row][col] = 0;
      this.applyGravity();
      // Auto-merge after clear
      var merged = false;
      do {
        merged = false;
        for (var mr = 0; mr < ROWS; mr++) {
          for (var mc = 0; mc < COLS; mc++) {
            var mv = this.grid[mr][mc];
            if (mv === 0) continue;
            if (mr + 1 < ROWS && this.grid[mr + 1][mc] === mv) {
              this.grid[mr][mc] = mv * 2;
              this.grid[mr + 1][mc] = 0;
              this.score += mv * 2;
              merged = true;
            }
            if (mc + 1 < COLS && this.grid[mr][mc + 1] === mv) {
              this.grid[mr][mc] = mv * 2;
              this.grid[mr][mc + 1] = 0;
              this.score += mv * 2;
              merged = true;
            }
          }
        }
        if (merged) this.applyGravity();
      } while (merged);
      var cc = this.data.clearCount - 1;
      this.setData({
        grid: this.buildDisplayGrid(),
        score: this.score,
        clearCount: cc,
        activePower: cc > 0 ? 'clear' : '',
        hintText: cc > 0 ? '点击要消除的数字' : '点击下方列放入数字',
        gameOver: this.isBoardFull()
      });

    } else if (power === 'supremeWand') {
      if (value === 0) return;
      // Show number picker instead of directly transforming
      var opts = [
        value * 2,
        value * 4,
        value * 8,
        value * 16,
        value * 32
      ];
      this.data.supremePicker = { base: value, options: opts, row: row, col: col };
      this.setData({
        supremePicker: { base: value, options: opts, row: row, col: col },
        activePower: '',
        hintText: '选择要变成的数字'
      });
    }
  },

  onSelectPower: function(e) {
    if (this.gameOver) return;

    var type = e.currentTarget.dataset.type;
    var count = this.data[type + 'Count'];
    if (count <= 0) return;

    // Toggle off if already active
    if (this.data.activePower === type) {
      this.setData({
        swapCell: null,
        activePower: '',
        hintText: '点击下方列放入数字',
        grid: this.buildDisplayGrid()
      });
      return;
    }

    // Cancel previous power-up state
    this.setData({ swapCell: null });

    if (type === 'wand') {
      this.setData({ activePower: 'wand', hintText: '点击要变换的数字' });
    } else if (type === 'swap') {
      this.setData({ activePower: 'swap', hintText: '点击第一个数字' });
    } else if (type === 'clear') {
      this.setData({ activePower: 'clear', hintText: '点击要消除的数字' });
    } else if (type === 'supremeWand') {
      this.setData({ activePower: 'supremeWand', hintText: '点击数字，全部相同的都会变' });
    } else if (type === 'dragonHand') {
      this.triggerDragonHand();
    } else if (type === 'immortal') {
      this.triggerImmortal();
    }
  },

  onSupremePick: function(e) {
    var picker = this.data.supremePicker;
    if (!picker) return;

    var newVal = Number(e.currentTarget.dataset.value);
    var base = picker.base;

    // Transform all cells with base value to newVal
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (this.grid[r][c] === base) this.grid[r][c] = newVal;
      }
    }

    // Auto-merge
    this.applyGravity();
    var merged = false;
    do {
      merged = false;
      for (var mr = 0; mr < ROWS; mr++) {
        for (var mc = 0; mc < COLS; mc++) {
          var mv = this.grid[mr][mc];
          if (mv === 0) continue;
          if (mr + 1 < ROWS && this.grid[mr + 1][mc] === mv) {
            this.grid[mr][mc] = mv * 2;
            this.grid[mr + 1][mc] = 0;
            this.score += mv * 2;
            merged = true;
          }
          if (mc + 1 < COLS && this.grid[mr][mc + 1] === mv) {
            this.grid[mr][mc] = mv * 2;
            this.grid[mr][mc + 1] = 0;
            this.score += mv * 2;
            merged = true;
          }
        }
      }
      if (merged) this.applyGravity();
    } while (merged);
    this.gameOver = this.isBoardFull();

    var swc = this.data.supremeWandCount - 1;
    var self = this;
    this.setData({
      grid: this.buildDisplayGrid(),
      score: this.score,
      supremeWandCount: swc,
      supremePicker: null,
      hintText: '点击下方列放入数字',
      gameOver: this.gameOver,
      celebration: '至尊魔法棒！'
    });
    clearTimeout(this._celebTimer);
    this._celebTimer = setTimeout(function() {
      self.setData({ celebration: '' });
    }, 2000);
  },

  onCancelSupreme: function() {
    this.setData({
      supremePicker: null,
      activePower: this.data.supremeWandCount > 0 ? 'supremeWand' : '',
      hintText: '点击数字，全部相同的都会变'
    });
  },

  onNewGame: function() {
    this.setData({ showMenu: false });
    this.initGame();
  },

  onToggleMenu: function() {
    this.setData({ showMenu: !this.data.showMenu });
  },

  onCloseMenu: function() {
    this.setData({ showMenu: false });
  },

  onMenuRestart: function() {
    this.setData({ showMenu: false });
    this.initGame();
  },

  onToggleSfx: function() {
    var a = getAudio();
    var enabled = a.toggleSfx();
    this.setData({ sfxEnabled: enabled });
  },

  onToggleBgm: function() {
    var a = getAudio();
    var enabled = a.toggleBgm();
    this.setData({ bgmEnabled: enabled });
  },

  // ─── Game logic ──────────────────────────────────────────────

  placeNumber: function(col, value) {
    var targetRow = -1;
    for (var r = ROWS - 1; r >= 0; r--) {
      if (this.grid[r][col] === 0) { targetRow = r; break; }
    }
    if (targetRow === -1) return false;

    this.grid[targetRow][col] = value;
    this.dropCells = {};
    this.dropCells[targetRow + ',' + col] = 'start';
    this.mergeCells = {};
    this._activeCol = col;

    this.processMerges(targetRow, col);
    this.applyGravity();
    while (this.scanAndMerge()) {
      this.applyGravity();
    }
    return true;
  },

  spawnBonuses: function(count) {
    this.dropCells = {};
    this.mergeCells = {};

    var placed = [];
    for (var i = 0; i < count; i++) {
      var availCols = [];
      for (var c = 0; c < COLS; c++) {
        if (this.grid[0][c] === 0) availCols.push(c);
      }
      if (availCols.length === 0) break;

      var col = availCols[Math.floor(Math.random() * availCols.length)];
      var value = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];

      var targetRow = -1;
      for (var r = ROWS - 1; r >= 0; r--) {
        if (this.grid[r][col] === 0) { targetRow = r; break; }
      }
      if (targetRow === -1) continue;

      this.grid[targetRow][col] = value;
      this.dropCells[targetRow + ',' + col] = 'start';
      placed.push({ row: targetRow, col: col });
    }

    if (placed.length === 0) return 0;

    for (var p = 0; p < placed.length; p++) {
      this.processMerges(placed[p].row, placed[p].col);
    }
    this.applyGravity();
    while (this.scanAndMerge()) {
      this.applyGravity();
    }

    var mc = 0;
    for (var k in this.mergeCells) mc++;
    return mc;
  },

  processMerges: function(row, col) {
    var value = this.grid[row][col];
    if (value === 0) return;

    var dirs = [[1, 0], [-1, 0], [0, -1], [0, 1]];

    for (var d = 0; d < dirs.length; d++) {
      var nr = row + dirs[d][0];
      var nc = col + dirs[d][1];
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        if (this.grid[nr][nc] === value) {
          this.grid[row][col] = value * 2;
          this.grid[nr][nc] = 0;
          this.score += value * 2;
          this.mergeCells[row + ',' + col] = true;
          this.processMerges(row, col);
          return;
        }
      }
    }
  },

  applyGravity: function() {
    for (var c = 0; c < COLS; c++) {
      var w = ROWS - 1;
      for (var r = ROWS - 1; r >= 0; r--) {
        if (this.grid[r][c] !== 0) {
          if (r !== w) {
            this.grid[w][c] = this.grid[r][c];
            this.grid[r][c] = 0;
          }
          w--;
        }
      }
    }
  },

  scanAndMerge: function() {
    var merged = false;
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var v = this.grid[r][c];
        if (v === 0) continue;

        if (r + 1 < ROWS && this.grid[r + 1][c] === v) {
          this.grid[r][c] = v * 2;
          this.grid[r + 1][c] = 0;
          this.score += v * 2;
          this.mergeCells[r + ',' + c] = true;
          merged = true;
        }
        if (c + 1 < COLS && this.grid[r][c + 1] === v) {
          if (c + 1 === this._activeCol) {
            this.grid[r][c + 1] = v * 2;
            this.grid[r][c] = 0;
            this.score += v * 2;
            this.mergeCells[r + ',' + (c + 1)] = true;
          } else {
            this.grid[r][c] = v * 2;
            this.grid[r][c + 1] = 0;
            this.score += v * 2;
            this.mergeCells[r + ',' + c] = true;
          }
          merged = true;
        }
      }
    }
    return merged;
  },

  isBoardFull: function() {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (this.grid[r][c] === 0) return false;
      }
    }
    return true;
  },

  // ─── Upgrade powers ──────────────────────────────────────────

  triggerDragonHand: function() {
    var self = this;
    var count = this.data.dragonHandCount;
    if (count <= 0 || this.gameOver) return;

    this.setData({
      dragonHandCount: count - 1,
      activePower: '',
      hintText: '点击下方列放入数字',
      celebration: '龙王的手！'
    });

    clearTimeout(this._celebTimer);
    this._celebTimer = setTimeout(function() {
      self.setData({ celebration: '' });
    }, 3000);

    this._dragonDrops = 20;
    this._doDragonWave();
  },

  _doDragonWave: function() {
    if (this._dragonDrops <= 0 || this.gameOver) return;

    // Drop 2 or 3 numbers per wave
    var count = 2 + Math.floor(Math.random() * 2);
    if (count > this._dragonDrops) count = this._dragonDrops;
    this._dragonDrops -= count;

    this.dropCells = {};
    this.mergeCells = {};

    for (var i = 0; i < count; i++) {
      var topMin = Infinity;
      for (var c = 0; c < COLS; c++) {
        for (var r = 0; r < ROWS; r++) {
          if (this.grid[r][c] > 0) {
            if (this.grid[r][c] < topMin) topMin = this.grid[r][c];
            break;
          }
        }
      }

      var value = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
      if (topMin !== Infinity && value > topMin) value = topMin;

      var matchCols = [];
      var nextCols = [];
      for (var c = 0; c < COLS; c++) {
        if (this.grid[0][c] !== 0) continue;
        var hasMatch = false, hasNext = false;
        for (var r = 0; r < ROWS; r++) {
          if (this.grid[r][c] === value) hasMatch = true;
          if (this.grid[r][c] === value * 2) hasNext = true;
        }
        if (hasMatch) matchCols.push(c);
        else if (hasNext) nextCols.push(c);
      }

      var targetCols = matchCols.length > 0 ? matchCols : (nextCols.length > 0 ? nextCols : []);
      if (targetCols.length === 0) {
        for (var c2 = 0; c2 < COLS; c2++) {
          if (this.grid[0][c2] === 0) targetCols.push(c2);
        }
      }
      if (targetCols.length === 0) return;

      var col = targetCols[Math.floor(Math.random() * targetCols.length)];

      var targetRow = -1;
      for (var rr = ROWS - 1; rr >= 0; rr--) {
        if (this.grid[rr][col] === 0) { targetRow = rr; break; }
      }
      if (targetRow === -1) continue;

      this.grid[targetRow][col] = value;
      this.dropCells[targetRow + ',' + col] = 'start';
    }

    this.gameOver = this.isBoardFull();

    var self = this;
    // Animate drop first, then process merges
    this.runWave(function() {
      // After numbers land, process merges
      var placedKeys = Object.keys(self.dropCells);
      // Process merges then gravity
      self.mergeCells = {};
      for (var p = 0; p < placedKeys.length; p++) {
        var parts = placedKeys[p].split(',');
        self.processMerges(parseInt(parts[0]), parseInt(parts[1]));
      }
      self.applyGravity();
      while (self.scanAndMerge()) {
        self.applyGravity();
      }
      self.applyGravity();

      var hasMerge = false;
      for (var k in self.mergeCells) { hasMerge = true; break; }

      if (hasMerge) {
        getAudio().playMerge();
      }
      self.setData({ grid: self.buildDisplayGrid(), score: self.score });
      self._doDragonWave();
    }, 3);
  },

  triggerImmortal: function() {
    var count = this.data.immortalCount;
    if (count <= 0 || this.gameOver) return;

    this.setData({
      immortalCount: count - 1,
      activePower: '',
      hintText: '点击下方列放入数字',
      celebration: '绝世仙尊！'
    });

    var self = this;
    clearTimeout(this._celebTimer);
    this._celebTimer = setTimeout(function() {
      self.setData({ celebration: '' });
    }, 3000);

    // Fill all cells with random numbers as drop cells
    this.dropCells = {};
    this.mergeCells = {};
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        this.grid[r][c] = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
        this.dropCells[r + ',' + c] = 'start';
      }
    }

    // Animate the rain of numbers
    this.runWave(function() {
      // After falling, merge chain with animation
      self._immortalMerge();
    });
  },

  _immortalMerge: function() {
    // Process one round of gravity + merges
    this.applyGravity();

    this.mergeCells = {};
    var merged = false;

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var v = this.grid[r][c];
        if (v === 0) continue;
        if (r + 1 < ROWS && this.grid[r + 1][c] === v) {
          this.grid[r][c] = v * 2;
          this.grid[r + 1][c] = 0;
          this.score += v * 2;
          this.mergeCells[r + ',' + c] = true;
          merged = true;
        }
        if (c + 1 < COLS && this.grid[r][c + 1] === v) {
          this.grid[r][c] = v * 2;
          this.grid[r][c + 1] = 0;
          this.score += v * 2;
          this.mergeCells[r + ',' + c] = true;
          merged = true;
        }
      }
    }

    if (!merged) {
      this.gameOver = this.isBoardFull();
      this.setData({
        grid: this.buildDisplayGrid(),
        score: this.score,
        gameOver: this.gameOver
      });
      return;
    }

    getAudio().playMerge();
    var self = this;
    this.setData({
      grid: this.buildDisplayGrid(),
      score: this.score
    });
    clearTimeout(this._animTimer);
    this._animTimer = setTimeout(function() {
      self._immortalMerge();
    }, 200);
  },

  // ─── Animation ───────────────────────────────────────────────

  runWave: function(callback, speed) {
    var spd = speed || 1;
    var self = this;

    getAudio().playDrop();

    var hasMerge = false;
    for (var k in this.mergeCells) { hasMerge = true; break; }
    if (hasMerge) getAudio().playMerge();

    this.setData({
      grid: this.buildDisplayGrid(),
      score: this.score,
      currentNumber: this.currentNumber,
      gameOver: this.gameOver
    });

    setTimeout(function() {
      for (var k in self.dropCells) {
        self.dropCells[k] = 'fall';
      }
      self.setData({ grid: self.buildDisplayGrid(), score: self.score, gameOver: self.gameOver });

      clearTimeout(self._animTimer);
      self._animTimer = setTimeout(function() {
        self.clearAnimations();
        if (callback) callback();
      }, Math.floor(300 / spd));
    }, Math.floor(50 / spd));
  },

  chainBonuses: function(mergeCount) {
    var bonus = getBonusCount(mergeCount);
    if (bonus === 0 || this.gameOver) return;

    // 20% chance of hidden surprise
    if (Math.random() < 0.2) {
      this.triggerSurprise(mergeCount);
      return;
    }

    var newMerges = this.spawnBonuses(bonus);
    var hasDrops = false;
    for (var k in this.dropCells) { hasDrops = true; break; }
    if (!hasDrops) return;

    this.gameOver = this.isBoardFull();

    var self = this;
    var text = getCelebration(mergeCount);
    self.setData({ celebration: text });
    clearTimeout(self._celebTimer);
    self._celebTimer = setTimeout(function() {
      self.setData({ celebration: '' });
    }, 1500);

    this.runWave(function() {
      self.chainBonuses(newMerges);
    });
  },

  triggerSurprise: function(mergeCount) {
    var r = Math.random();
    var self = this;

    if (r < 0.25) {
      // Fill all empty cells with 2, then process merges
      for (var row = 0; row < ROWS; row++) {
        for (var col = 0; col < COLS; col++) {
          if (this.grid[row][col] === 0) this.grid[row][col] = 2;
        }
      }
      this.mergeCells = {};
      this.applyGravity();
      while (this.scanAndMerge()) {
        this.applyGravity();
      }
      this.gameOver = this.isBoardFull();
      this.setData({ grid: this.buildDisplayGrid(), score: this.score, celebration: '惊喜！填满2', gameOver: this.gameOver });
      clearTimeout(this._celebTimer);
      this._celebTimer = setTimeout(function() { self.setData({ celebration: '' }); }, 2000);

    } else if (r < 0.5) {
      // 5% overall: Smallest number becomes second smallest
      var minVal = Infinity, secondMin = Infinity;
      for (var row = 0; row < ROWS; row++) {
        for (var col = 0; col < COLS; col++) {
          var v = this.grid[row][col];
          if (v > 0 && v < minVal) { secondMin = minVal; minVal = v; }
          else if (v > minVal && v < secondMin) { secondMin = v; }
        }
      }
      if (secondMin === Infinity) secondMin = minVal * 2;
      for (var row2 = 0; row2 < ROWS; row2++) {
        for (var col2 = 0; col2 < COLS; col2++) {
          if (this.grid[row2][col2] === minVal) this.grid[row2][col2] = secondMin;
        }
      }
      this.setData({ grid: this.buildDisplayGrid(), celebration: '惊喜！数字升级' });
      clearTimeout(this._celebTimer);
      this._celebTimer = setTimeout(function() { self.setData({ celebration: '' }); }, 2000);

    } else if (r < 0.75) {
      // 5% overall: 3 consecutive columns get 5 random drops each
      var startCol = Math.floor(Math.random() * (COLS - 2));
      this.dropCells = {};
      this.mergeCells = {};
      for (var ci = startCol; ci < startCol + 3; ci++) {
        for (var ri = 0; ri < 5; ri++) {
          if (this.grid[0][ci] !== 0) break;
          var val = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
          var tr = -1;
          for (var rr = ROWS - 1; rr >= 0; rr--) {
            if (this.grid[rr][ci] === 0) { tr = rr; break; }
          }
          if (tr === -1) break;
          this.grid[tr][ci] = val;
          this.dropCells[tr + ',' + ci] = 'start';
        }
      }
      this.gameOver = this.isBoardFull();
      this.setData({ celebration: '惊喜！数字雨', gameOver: this.gameOver });
      clearTimeout(this._celebTimer);
      this._celebTimer = setTimeout(function() { self.setData({ celebration: '' }); }, 2000);
      this.runWave(function() {});

    } else {
      // 5% overall: Fill all cells with random numbers
      for (var row3 = 0; row3 < ROWS; row3++) {
        for (var col3 = 0; col3 < COLS; col3++) {
          this.grid[row3][col3] = SPAWN_VALUES[Math.floor(Math.random() * SPAWN_VALUES.length)];
        }
      }
      this.gameOver = this.isBoardFull();
      this.setData({ grid: this.buildDisplayGrid(), celebration: '惊喜！全部填满', gameOver: this.gameOver });
      clearTimeout(this._celebTimer);
      this._celebTimer = setTimeout(function() { self.setData({ celebration: '' }); }, 2000);
    }
  }
});
