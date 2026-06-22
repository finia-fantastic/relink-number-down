var C = require('./constants.js');
var GL = require('./game-logic.js');
var state = GL.state;
var audio = require('./audio.js');

var _sw = 0, _sc = 1;
var _touchStartX = 0, _touchStartY = 0, _touchStartTime = 0;
var _isScrolling = false, _scrollBaseY = 0, _lastDy = 0, _lastTime = 0;

function initInput(screenW) {
  _sw = screenW; _sc = screenW / C.DESIGN_W;

  wx.onTouchStart(function(e) {
    var t = e.touches[0];
    _touchStartX = t.clientX; _touchStartY = t.clientY; _touchStartTime = Date.now();
    _isScrolling = false; _scrollBaseY = state.scrollY; _lastDy = 0; _lastTime = _touchStartTime;
  });

  wx.onTouchMove(function(e) {
    var t = e.touches[0], dy = _touchStartY - t.clientY;
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
  if (state.gameOver) { GL.restartGame(); return; }
  if (state.showMenu) {
    var mh = hitMenu(x, y);
    if (mh) { handleMenuHit(mh); return; }
    state.showMenu = false; return;
  }
  if (state.supremePicker) {
    var pv = hitSupremePicker(x, y);
    if (pv === 'exit') { GL.onCancelSupreme(); return; }
    if (pv > 0) { GL.onSupremePick(pv); return; }
  }
  if (hitMenuBtn(x, y)) { GL.toggleMenu(); return; }
  var pw = hitPowerBtn(x, y); if (pw) { GL.selectPower(pw); return; }
  var up = hitUpgradeBtn(x, y); if (up) { GL.selectPower(up); return; }
  var cell = hitCell(x, y);
  if (cell) { handleCellTap(cell.row, cell.col); return; }
}

function hitMenuBtn(x, y) {
  var bx = _sw - 66 * _sc - 56 * _sc, by = C.HEADER_PAD_TOP * _sc + 7 * _sc;
  return x >= bx && x <= bx + 56 * _sc && y >= by && y <= by + 56 * _sc;
}

function hitPowerBtn(x, y) {
  var py = C.HEADER_H * _sc + 10 * _sc, pw = 64 * _sc, px = _sw - 30 * _sc - pw;
  var powers = ['wand', 'swap', 'clear'];
  for (var i = 0; i < powers.length; i++) {
    var bx = px - i * (pw + 8 * _sc);
    if (x >= bx && x <= bx + pw && y >= py && y <= py + 64 * _sc) return powers[i];
  }
  return null;
}

function hitUpgradeBtn(x, y) {
  var by = (C.HEADER_H + C.CONTROL_H) * _sc, bw = 150 * _sc, bh = 46 * _sc;
  var items = ['supremeWand', 'dragonHand', 'immortal'];
  var totalW = items.length * bw + 2 * 12 * _sc, sx = (_sw - totalW) / 2;
  for (var i = 0; i < items.length; i++) {
    var bx = sx + i * (bw + 12 * _sc);
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return items[i];
  }
  return null;
}

function hitCell(x, y) {
  var cellW = C.CELL_W * _sc, cellH = C.CELL_H * _sc, gap = C.GAP * _sc, rowH = C.ROW_H * _sc;
  var totalW = C.COLS * cellW + (C.COLS - 1) * gap;
  var bl = (_sw - totalW) / 2, bt = C.BOARD_TOP * _sc - state.scrollY;
  for (var r = 0; r < C.ROWS; r++) {
    for (var c = 0; c < C.COLS; c++) {
      var cx = bl + c * (cellW + gap), cy = bt + r * rowH;
      if (x >= cx && x <= cx + cellW && y >= cy && y <= cy + cellH) return { row: r, col: c };
    }
  }
  return null;
}

function hitSupremePicker(x, y) {
  var py = C.HEADER_H * _sc + 30 * _sc, exitS = 50 * _sc, ecx = 20 * _sc + exitS / 2, ecy = py + exitS / 2;
  if ((x - ecx) * (x - ecx) + (y - ecy) * (y - ecy) <= (exitS / 2) * (exitS / 2)) return 'exit';
  var ow = 90 * _sc, oh = 70 * _sc, sx = 20 * _sc + exitS + 16 * _sc;
  var opts = state.supremePicker.options;
  for (var i = 0; i < opts.length; i++) {
    var ox = sx + i * (ow + 10 * _sc);
    if (x >= ox && x <= ox + ow && y >= py && y <= py + oh) return opts[i];
  }
  return 0;
}

function hitMenu(x, y) {
  var mw = 280 * _sc, mx = _sw - 30 * _sc - mw, my = 100 * _sc, itemH = 56 * _sc;
  if (x >= mx && x <= mx + mw && y >= my && y <= my + itemH * 4) {
    var idx = Math.floor((y - my) / itemH);
    if (idx === 0) return 'sfx'; if (idx === 1) return 'bgm'; if (idx === 2) return 'restart';
  }
  return null;
}

function handleMenuHit(type) {
  if (type === 'sfx') audio.toggleSfx();
  else if (type === 'bgm') audio.toggleBgm();
  else if (type === 'restart') GL.restartGame();
}

function handleCellTap(row, col) {
  if (state.gameOver) return;
  if (state.supremePicker) { GL.handleSupremeTap(row, col); return; }
  if (state.activePower) { GL.handlePowerTap(row, col); return; }
  if (!GL.placeNumber(col, state.currentNumber)) {
    if (GL.isBoardFull()) state.gameOver = true;
    return;
  }
  var mc = GL.countMergeCells();
  state.currentNumber = GL.generateNumber();
  state.gameOver = GL.isBoardFull();
  GL.runWave(function() { GL.chainBonuses(mc); });
}

module.exports = { initInput: initInput };
