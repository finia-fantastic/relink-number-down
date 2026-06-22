var _touchStartX = 0;
var _touchStartY = 0;
var _touchStartTime = 0;
var _isScrolling = false;
var _scrollBaseY = 0;
var _lastDy = 0;
var _lastTime = 0;

function initInput() {
  wx.onTouchStart(function(e) {
    var t = e.touches[0];
    _touchStartX = t.clientX;
    _touchStartY = t.clientY;
    _touchStartTime = Date.now();
    _isScrolling = false;
    _scrollBaseY = state.scrollY;
    _lastDy = 0;
    _lastTime = _touchStartTime;
  });

  wx.onTouchMove(function(e) {
    var t = e.touches[0];
    var dy = _touchStartY - t.clientY;
    if (!_isScrolling && Math.abs(dy) > 8 && Math.abs(_touchStartX - t.clientX) < Math.abs(dy) * 2) {
      _isScrolling = true;
    }
    if (_isScrolling) {
      state.scrollY = _scrollBaseY + dy;
      if (state.scrollY < 0) state.scrollY = 0;
      if (state.scrollY > state.maxScrollY) state.scrollY = state.maxScrollY;
      _lastDy = t.clientY - _touchStartY;
      _lastTime = Date.now();
    }
  });

  wx.onTouchEnd(function(e) {
    if (_isScrolling) {
      var dt = Date.now() - _lastTime;
      if (dt > 0 && dt < 100) {
        state.scrollVelocity = -_lastDy / dt * 16;
      }
      return;
    }

    var elapsed = Date.now() - _touchStartTime;
    if (elapsed > 300) return;

    var t = e.changedTouches[0];
    hitTest(t.clientX, t.clientY);
  });
}

function hitTest(x, y) {
  // 1. Game over → restart
  if (state.gameOver) {
    restartGame();
    return;
  }

  // 2. Menu visible
  if (state.showMenu) {
    var hit = hitMenu(x, y);
    if (hit) { handleMenuHit(hit); return; }
    state.showMenu = false;
    return;
  }

  // 3. Supreme picker
  if (state.supremePicker) {
    var pickVal = hitSupremePicker(x, y);
    if (pickVal === 'exit') { onCancelSupreme(); return; }
    if (pickVal > 0) { onSupremePick(pickVal); return; }
  }

  // 4. Header menu button
  if (hitMenuBtn(x, y)) { toggleMenu(); return; }

  // 5. Power buttons (basic)
  var pw = hitPowerBtn(x, y);
  if (pw) { selectPower(pw); return; }

  // 6. Upgrade power buttons
  var up = hitUpgradeBtn(x, y);
  if (up) { selectPower(up); return; }

  // 7. Board cells
  var cell = hitCell(x, y);
  if (cell) {
    handleCellTap(cell.row, cell.col);
    return;
  }
}

// ─── Hit-test helpers ─────────────────────────────────────────

function hitMenuBtn(x, y) {
  var bx = _sw - 66 * _sc - 56 * _sc;
  var by = HEADER_PAD_TOP * _sc + 7 * _sc;
  var bw = 56 * _sc;
  var bh = 56 * _sc;
  return x >= bx && x <= bx + bw && y >= by && y <= by + bh;
}

function hitPowerBtn(x, y) {
  var py = HEADER_H * _sc + 10 * _sc;
  var pw = 64 * _sc;
  var ph = 64 * _sc;
  var px = _sw - 30 * _sc - pw;
  var powers = ['wand', 'swap', 'clear'];
  for (var i = 0; i < powers.length; i++) {
    var bx = px - i * (pw + 8 * _sc);
    if (x >= bx && x <= bx + pw && y >= py && y <= py + ph) {
      return powers[i];
    }
  }
  return null;
}

function hitUpgradeBtn(x, y) {
  var by = (HEADER_H + CONTROL_H) * _sc;
  var bw = 150 * _sc;
  var bh = 46 * _sc;
  var items = ['supremeWand', 'dragonHand', 'immortal'];
  var totalW = items.length * bw + (items.length - 1) * 12 * _sc;
  var sx = (_sw - totalW) / 2;
  for (var i = 0; i < items.length; i++) {
    var bx = sx + i * (bw + 12 * _sc);
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
      return items[i];
    }
  }
  return null;
}

function hitCell(x, y) {
  var cellW = CELL_W * _sc;
  var cellH = CELL_H * _sc;
  var gap = GAP * _sc;
  var rowH = ROW_H * _sc;
  var totalBoardW = COLS * cellW + (COLS - 1) * gap;
  var boardLeft = (_sw - totalBoardW) / 2;
  var boardTop = BOARD_TOP * _sc - state.scrollY;

  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var cx = boardLeft + c * (cellW + gap);
      var cy = boardTop + r * rowH;
      if (x >= cx && x <= cx + cellW && y >= cy && y <= cy + cellH) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

function hitSupremePicker(x, y) {
  var py = HEADER_H * _sc + 30 * _sc;
  var exitS = 50 * _sc;
  var exitX = 20 * _sc;
  var exitCX = exitX + exitS / 2;
  var exitCY = py + exitS / 2;
  var dx = x - exitCX;
  var dy = y - exitCY;
  if (dx * dx + dy * dy <= (exitS / 2) * (exitS / 2)) return 'exit';

  var ow = 90 * _sc;
  var oh = 70 * _sc;
  var startX = exitX + exitS + 16 * _sc;
  var opts = state.supremePicker.options;
  for (var i = 0; i < opts.length; i++) {
    var ox = startX + i * (ow + 10 * _sc);
    if (x >= ox && x <= ox + ow && y >= py && y <= py + oh) {
      return opts[i];
    }
  }
  return 0;
}

function hitMenu(x, y) {
  var mw = 280 * _sc;
  var mx = _sw - 30 * _sc - mw;
  var my = 100 * _sc;
  var itemH = 56 * _sc;
  var mh = itemH * 4 + 1 * _sc;

  if (x >= mx && x <= mx + mw && y >= my && y <= my + mh) {
    var relY = y - my;
    var idx = Math.floor(relY / itemH);
    if (idx === 0) return 'sfx';
    if (idx === 1) return 'bgm';
    if (idx === 2) return 'restart';
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

  if (state.supremePicker) {
    handleSupremeTap(row, col);
    return;
  }

  if (state.activePower) {
    handlePowerTap(row, col);
    return;
  }

  if (!placeNumber(col, state.currentNumber)) {
    if (isBoardFull()) {
      state.gameOver = true;
    }
    return;
  }

  var mergeCount = countMergeCells();
  state.currentNumber = generateNumber();
  state.gameOver = isBoardFull();

  runWave(function() {
    chainBonuses(mergeCount);
  });
}
