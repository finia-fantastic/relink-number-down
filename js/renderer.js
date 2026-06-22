var _ctx = null;
var _sw = 0; // screen width in logical px
var _sh = 0; // screen height
var _sc = 1; // scale factor (px per design unit)

function initRenderer(ctx, screenW, screenH) {
  _ctx = ctx;
  _sw = screenW;
  _sh = screenH;
  _sc = screenW / DESIGN_W;
}

// ─── Drawing helpers ──────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function fillCellBg(ctx, x, y, w, h, value) {
  var color = CELL_COLORS[value] || CELL_COLORS[0];
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, 8 * _sc);
  ctx.fill();
}

function drawCellText(ctx, x, y, w, h, value) {
  if (value <= 0) return;
  ctx.fillStyle = getTextColor(value);
  var fs = getFontSize(value) * _sc;
  ctx.font = 'bold ' + fs + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), x + w / 2, y + h / 2);
}

function fillText(ctx, text, x, y, fontSize, color, bold) {
  ctx.fillStyle = color;
  var f = (bold ? 'bold ' : '') + (fontSize * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.font = f;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
}

// ─── Main render ──────────────────────────────────────────────

function render() {
  var ctx = _ctx;
  ctx.clearRect(0, 0, _sw, _sh);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, _sw, _sh);

  drawHeader();
  drawControlRow();
  drawUpgradeRow();
  drawHint();
  drawBoard();
  drawCelebration();
  drawGameOver();
  drawMenu();
}

// ─── Header ────────────────────────────────────────────────────

function drawHeader() {
  var ctx = _ctx;
  var y = HEADER_PAD_TOP * _sc;
  var pad = 30 * _sc;

  // Title
  ctx.fillStyle = TITLE_COLOR;
  ctx.font = 'bold ' + (40 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('数字合成', pad, y + 10 * _sc);

  // Score box
  var sbW = 130 * _sc;
  var sbH = 70 * _sc;
  var sbX = _sw - sbW - pad;
  ctx.fillStyle = HEADER_BG;
  roundRect(ctx, sbX, y, sbW, sbH, 8 * _sc);
  ctx.fill();

  ctx.fillStyle = HEADER_TEXT;
  ctx.font = (22 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('分数', sbX + sbW / 2, y + 12 * _sc);

  ctx.font = 'bold ' + (36 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.fillText(String(state.score), sbX + sbW / 2, y + 36 * _sc);

  // Hamburger button
  var btnX = sbX - 66 * _sc;
  var btnW = 56 * _sc;
  var btnH = 56 * _sc;
  ctx.fillStyle = HEADER_BG;
  roundRect(ctx, btnX, y + 7 * _sc, btnW, btnH, 8 * _sc);
  ctx.fill();

  ctx.fillStyle = HEADER_TEXT;
  var barW = 32 * _sc;
  var barH = 4 * _sc;
  var barX = btnX + (btnW - barW) / 2;
  for (var i = 0; i < 3; i++) {
    roundRect(ctx, barX, y + 17 * _sc + i * 12 * _sc, barW, barH, 2 * _sc);
    ctx.fill();
  }
}

// ─── Control row (next number + basic power buttons) ──────────

function drawControlRow() {
  if (state.supremePicker) { drawSupremePicker(); return; }

  var ctx = _ctx;
  var y = HEADER_H * _sc;
  var w = _sw;
  var cx = w / 2;

  // "下一个数字" label
  ctx.fillStyle = TITLE_COLOR;
  ctx.font = (24 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('下一个数字', cx, y + 4 * _sc);

  // Next number cell
  var cellS = 90 * _sc;
  var cellX = cx - cellS / 2;
  var cellY = y + 30 * _sc;
  fillCellBg(ctx, cellX, cellY, cellS, cellS, state.currentNumber);
  drawCellText(ctx, cellX, cellY, cellS, cellS, state.currentNumber);

  // Power buttons (right side)
  var pw = 64 * _sc;
  var ph = 64 * _sc;
  var px = w - 30 * _sc - pw;
  var py = y + 10 * _sc;
  var powers = ['wand', 'swap', 'clear'];

  for (var i = 0; i < powers.length; i++) {
    var p = powers[i];
    var bx = px - i * (pw + 8 * _sc);
    drawPowerBtn(bx, py, pw, ph, p, state[p + 'Count']);
  }
}

function drawPowerBtn(x, y, w, h, type, count) {
  var ctx = _ctx;
  var active = state.activePower === type;
  var empty = count <= 0;
  var alpha = empty ? 0.35 : 1;
  ctx.globalAlpha = alpha;

  // Background
  ctx.fillStyle = active ? POWER_ACTIVE_BG : '#ffffff';
  roundRect(ctx, x, y, w, h, 8 * _sc);
  ctx.fill();

  // Border
  ctx.strokeStyle = active ? POWER_ACTIVE_BORDER : POWER_BORDER;
  ctx.lineWidth = 2 * _sc;
  roundRect(ctx, x, y, w, h, 8 * _sc);
  ctx.stroke();

  // Icon (simple Chinese char or emoji fallback)
  var icons = { wand: '🪄', swap: '🔄', clear: '💣' };
  var icon = icons[type] || '?';
  ctx.fillStyle = '#333';
  ctx.font = (22 * _sc) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, x + w / 2, y + h * 0.45);

  // Count
  ctx.fillStyle = '#bbada0';
  ctx.font = (14 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.fillText('x' + count, x + w / 2, y + h * 0.72);

  ctx.globalAlpha = 1;
}

// ─── Supreme picker ────────────────────────────────────────────

function drawSupremePicker() {
  var ctx = _ctx;
  var y = HEADER_H * _sc;
  var w = _sw;

  ctx.fillStyle = '#bbada0';
  ctx.font = (22 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(state.hintText, w / 2, y + 8 * _sc);

  // Exit button
  var exitS = 50 * _sc;
  var exitX = 20 * _sc;
  var exitY = y + 30 * _sc;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#dddddd';
  ctx.lineWidth = 2 * _sc;
  ctx.beginPath();
  ctx.arc(exitX + exitS / 2, exitY + exitS / 2, exitS / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#999999';
  ctx.font = (26 * _sc) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✕', exitX + exitS / 2, exitY + exitS / 2);

  // Option tiles
  var opts = state.supremePicker.options;
  var ow = 90 * _sc;
  var oh = 70 * _sc;
  var startX = exitX + exitS + 16 * _sc;
  for (var i = 0; i < opts.length; i++) {
    var ox = startX + i * (ow + 10 * _sc);
    fillCellBg(ctx, ox, exitY, ow, oh, opts[i]);
    drawCellText(ctx, ox, exitY, ow, oh, opts[i]);
  }
}

// ─── Upgrade power row ─────────────────────────────────────────

function drawUpgradeRow() {
  if (state.supremePicker) return;
  var ctx = _ctx;
  var y = (HEADER_H + CONTROL_H) * _sc;
  var w = _sw;

  var items = [
    { type: 'supremeWand', label: '至尊魔法棒' },
    { type: 'dragonHand',  label: '龙王的手' },
    { type: 'immortal',    label: '绝世仙尊' }
  ];

  var bw = 150 * _sc;
  var bh = 46 * _sc;
  var totalW = items.length * bw + (items.length - 1) * 12 * _sc;
  var sx = (w - totalW) / 2;

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var bx = sx + i * (bw + 12 * _sc);
    var active = state.activePower === it.type;
    var empty = state[it.type + 'Count'] <= 0;
    var alpha = empty ? 0.35 : 1;
    ctx.globalAlpha = alpha;

    ctx.fillStyle = active ? POWER_ACTIVE_BG : '#ffffff';
    roundRect(ctx, bx, y, bw, bh, 20 * _sc);
    ctx.fill();
    ctx.strokeStyle = active ? POWER_ACTIVE_BORDER : POWER_BORDER;
    ctx.lineWidth = 2 * _sc;
    roundRect(ctx, bx, y, bw, bh, 20 * _sc);
    ctx.stroke();

    ctx.fillStyle = TITLE_COLOR;
    ctx.font = (22 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(it.label, bx + bw / 2, y + bh / 2);

    ctx.globalAlpha = 1;
  }
}

// ─── Hint ──────────────────────────────────────────────────────

function drawHint() {
  var ctx = _ctx;
  var y = (HEADER_H + CONTROL_H + UPGRADE_H) * _sc;
  ctx.fillStyle = HINT_COLOR;
  ctx.font = (22 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(state.hintText, _sw / 2, y + 4 * _sc);
}

// ─── Board ─────────────────────────────────────────────────────

function drawBoard() {
  var ctx = _ctx;
  var boardTop = BOARD_TOP * _sc - state.scrollY;
  var cellW = CELL_W * _sc;
  var cellH = CELL_H * _sc;
  var gap = GAP * _sc;
  var rowH = ROW_H * _sc;
  var totalBoardW = COLS * cellW + (COLS - 1) * gap;
  var boardLeft = (_sw - totalBoardW) / 2;

  // Max scroll
  var totalH = ROWS * rowH;
  var visibleH = _sh - BOARD_TOP * _sc;
  state.maxScrollY = Math.max(0, totalH - visibleH);

  // Clip to board area
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, BOARD_TOP * _sc, _sw, visibleH);
  ctx.clip();

  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var cx = boardLeft + c * (cellW + gap);
      var cy = boardTop + r * rowH;

      // Skip off-screen cells
      if (cy + cellH < BOARD_TOP * _sc || cy > _sh) continue;

      // Drop animation offset
      var key = r + ',' + c;
      var phase = state.dropCells[key];
      var offsetY = 0;
      if (phase === 'start') {
        offsetY = -(r * ROW_H + 150) * _sc;
      }

      // Draw cell
      var value = state.grid[r][c];
      drawCell(cx, cy + offsetY, cellW, cellH, value, r, c);
    }
  }

  ctx.restore();
}

function drawCell(x, y, w, h, value, row, col) {
  var ctx = _ctx;
  var key = row + ',' + col;

  // Background
  fillCellBg(ctx, x, y, w, h, value);

  // Highlight: swap-selected / supreme-selected
  var highlight = false;
  if (state.swapCell && state.swapCell.row === row && state.swapCell.col === col) highlight = true;
  if (state.supremePicker && state.supremePicker.row === row && state.supremePicker.col === col) highlight = true;
  if (highlight) {
    ctx.save();
    ctx.strokeStyle = SWAP_GLOW;
    ctx.lineWidth = 4 * _sc;
    ctx.shadowColor = SWAP_GLOW;
    ctx.shadowBlur = 12 * _sc;
    roundRect(ctx, x, y, w, h, 8 * _sc);
    ctx.stroke();
    ctx.restore();
  }

  // Text
  drawCellText(ctx, x, y, w, h, value);
}

// ─── Celebration ───────────────────────────────────────────────

function drawCelebration() {
  if (!state.celebration) return;
  var ctx = _ctx;
  var elapsed = Date.now() - state.celebTime;
  var progress = Math.min(1, elapsed / 900);
  var t = getCelebTransform(progress);

  ctx.save();
  ctx.globalAlpha = t.alpha;
  ctx.translate(_sw / 2, _sh / 2);
  ctx.scale(t.scale, t.scale);

  ctx.fillStyle = CELEB_COLOR;
  ctx.font = 'bold ' + (56 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Text shadow
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.fillText(state.celebration, 2 * _sc, 2 * _sc);
  ctx.fillStyle = CELEB_COLOR;
  ctx.fillText(state.celebration, 0, 0);

  ctx.restore();
}

// ─── Game over ─────────────────────────────────────────────────

function drawGameOver() {
  if (!state.gameOver) return;
  var ctx = _ctx;
  ctx.fillStyle = OVERLAY_BG;
  ctx.fillRect(0, 0, _sw, _sh);

  var boxW = 380 * _sc;
  var boxH = 280 * _sc;
  var bx = (_sw - boxW) / 2;
  var by = (_sh - boxH) / 2;

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, bx, by, boxW, boxH, 12 * _sc);
  ctx.fill();

  ctx.fillStyle = TITLE_COLOR;
  ctx.font = 'bold ' + (48 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('游戏结束', _sw / 2, by + 70 * _sc);

  ctx.fillStyle = TITLE_COLOR;
  ctx.font = (32 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.fillText('得分: ' + state.score, _sw / 2, by + 140 * _sc);

  var btnW = 200 * _sc;
  var btnH = 56 * _sc;
  var btnX = (_sw - btnW) / 2;
  var btnY = by + 190 * _sc;
  ctx.fillStyle = NEWGAME_BG;
  roundRect(ctx, btnX, btnY, btnW, btnH, 8 * _sc);
  ctx.fill();
  ctx.fillStyle = '#f9f6f2';
  ctx.font = (28 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.fillText('重新开始', _sw / 2, btnY + btnH / 2);
}

// ─── Menu ──────────────────────────────────────────────────────

function drawMenu() {
  if (!state.showMenu) return;
  var ctx = _ctx;

  // Backdrop
  ctx.fillStyle = 'rgba(0,0,0,0.01)';
  ctx.fillRect(0, 0, _sw, _sh);

  // Popup
  var mw = 280 * _sc;
  var mx = _sw - 30 * _sc - mw;
  var my = 100 * _sc;
  var itemH = 56 * _sc;

  ctx.fillStyle = MENU_BG;
  roundRect(ctx, mx, my, mw, itemH * 4 + 1 * _sc, 10 * _sc);
  ctx.fill();

  // Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 24 * _sc;
  ctx.shadowOffsetY = 6 * _sc;
  roundRect(ctx, mx, my, mw, itemH * 4 + 1 * _sc, 10 * _sc);
  ctx.fill();
  ctx.restore();

  // Items
  var items = [
    { label: '音效', type: 'sfx' },
    { label: '背景音乐', type: 'bgm' },
    { label: '重新开始', type: 'restart' }
  ];

  for (var i = 0; i < items.length; i++) {
    var iy = my + i * itemH;
    var item = items[i];

    // Text
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = (28 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.label, mx + 30 * _sc, iy + itemH / 2);

    // Toggle switches for sfx/bgm
    if (item.type === 'sfx' || item.type === 'bgm') {
      var on = item.type === 'sfx' ? audio.sfxEnabled : audio.bgmEnabled;
      drawToggle(mx + mw - 90 * _sc, iy + (itemH - 36 * _sc) / 2, on);
    }

    // Divider before restart
    if (i === 2) {
      ctx.strokeStyle = '#e8e0d8';
      ctx.lineWidth = 1 * _sc;
      ctx.beginPath();
      ctx.moveTo(mx + 30 * _sc, iy);
      ctx.lineTo(mx + mw - 30 * _sc, iy);
      ctx.stroke();
    }
  }
}

function drawToggle(x, y, on) {
  var ctx = _ctx;
  var tw = 64 * _sc;
  var th = 36 * _sc;
  var knobR = 14 * _sc;

  ctx.fillStyle = on ? TOGGLE_ON_BG : TOGGLE_OFF_BG;
  roundRect(ctx, x, y, tw, th, 18 * _sc);
  ctx.fill();

  var knobX = on ? x + tw - 4 * _sc - knobR * 2 : x + 4 * _sc;
  var knobY = y + (th - knobR * 2) / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(knobX + knobR, knobY + knobR, knobR, 0, Math.PI * 2);
  ctx.fill();
}
