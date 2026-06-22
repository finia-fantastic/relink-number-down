var C = require('./constants.js');
var GL = require('./game-logic.js');
var state = GL.state;
var audio = require('./audio.js');
var anim = require('./animation.js');
var getCelebTransform = anim.getCelebTransform;

var _ctx = null, _sw = 0, _sh = 0, _sc = 1;

function initRenderer(ctx, screenW, screenH) {
  _ctx = ctx; _sw = screenW; _sh = screenH; _sc = screenW / C.DESIGN_W;
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
  ctx.fillStyle = C.CELL_COLORS[value] || C.CELL_COLORS[0];
  roundRect(ctx, x, y, w, h, 8 * _sc); ctx.fill();
}

function drawCellText(ctx, x, y, w, h, value) {
  if (value <= 0) return;
  ctx.fillStyle = C.getTextColor(value);
  ctx.font = 'bold ' + (C.getFontSize(value) * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(value), x + w / 2, y + h / 2);
}

// ─── Main ─────────────────────────────────────────────────

function render() {
  var ctx = _ctx;
  ctx.clearRect(0, 0, _sw, _sh);
  ctx.fillStyle = C.BG_COLOR; ctx.fillRect(0, 0, _sw, _sh);
  drawHeader(); drawControlRow(); drawUpgradeRow(); drawHint();
  drawBoard(); drawCelebration(); drawGameOver(); drawMenu();
}

// ─── Header ───────────────────────────────────────────────

function drawHeader() {
  var ctx = _ctx, y = C.HEADER_PAD_TOP * _sc, pad = 30 * _sc;
  ctx.fillStyle = C.TITLE_COLOR;
  ctx.font = 'bold ' + (40 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('数字合成', pad, y + 10 * _sc);
  var sbW = 130 * _sc, sbH = 70 * _sc, sbX = _sw - sbW - pad;
  ctx.fillStyle = C.HEADER_BG; roundRect(ctx, sbX, y, sbW, sbH, 8 * _sc); ctx.fill();
  ctx.fillStyle = C.HEADER_TEXT;
  ctx.font = (22 * _sc) + 'px "Helvetica Neue",Arial,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('分数', sbX + sbW / 2, y + 12 * _sc);
  ctx.font = 'bold ' + (36 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.fillText(String(state.score), sbX + sbW / 2, y + 36 * _sc);
  var btnX = sbX - 66 * _sc, btnW = 56 * _sc, btnH = 56 * _sc;
  ctx.fillStyle = C.HEADER_BG; roundRect(ctx, btnX, y + 7 * _sc, btnW, btnH, 8 * _sc); ctx.fill();
  ctx.fillStyle = C.HEADER_TEXT;
  var barW = 32 * _sc, barH = 4 * _sc, barX = btnX + (btnW - barW) / 2;
  for (var i = 0; i < 3; i++) {
    roundRect(ctx, barX, y + 17 * _sc + i * 12 * _sc, barW, barH, 2 * _sc); ctx.fill();
  }
}

// ─── Control ──────────────────────────────────────────────

function drawControlRow() {
  if (state.supremePicker) { drawSupremePicker(); return; }
  var ctx = _ctx, y = C.HEADER_H * _sc, cx = _sw / 2;
  ctx.fillStyle = C.TITLE_COLOR; ctx.font = (24 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
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
  var ctx = _ctx, active = state.activePower === type, empty = count <= 0;
  ctx.globalAlpha = empty ? 0.35 : 1;
  ctx.fillStyle = active ? C.POWER_ACTIVE_BG : '#ffffff';
  roundRect(ctx, x, y, w, h, 8 * _sc); ctx.fill();
  ctx.strokeStyle = active ? C.POWER_ACTIVE_BORDER : C.POWER_BORDER;
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
  var ctx = _ctx, y = C.HEADER_H * _sc;
  ctx.fillStyle = '#bbada0'; ctx.font = (22 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(state.hintText, _sw / 2, y + 8 * _sc);
  var exitS = 50 * _sc, exitX = 20 * _sc, exitY = y + 30 * _sc;
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#dddddd'; ctx.lineWidth = 2 * _sc;
  ctx.beginPath(); ctx.arc(exitX + exitS / 2, exitY + exitS / 2, exitS / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#999999'; ctx.font = (26 * _sc) + 'px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('✕', exitX + exitS / 2, exitY + exitS / 2);
  var opts = state.supremePicker.options, ow = 90 * _sc, oh = 70 * _sc, sx = exitX + exitS + 16 * _sc;
  for (var i = 0; i < opts.length; i++) {
    var ox = sx + i * (ow + 10 * _sc);
    fillCellBg(ctx, ox, exitY, ow, oh, opts[i]); drawCellText(ctx, ox, exitY, ow, oh, opts[i]);
  }
}

// ─── Upgrade ──────────────────────────────────────────────

function drawUpgradeRow() {
  if (state.supremePicker) return;
  var ctx = _ctx, y = (C.HEADER_H + C.CONTROL_H) * _sc;
  var items = [
    { type: 'supremeWand', label: '至尊魔法棒' },
    { type: 'dragonHand',  label: '龙王的手' },
    { type: 'immortal',    label: '绝世仙尊' }
  ];
  var bw = 150 * _sc, bh = 46 * _sc, totalW = items.length * bw + 2 * 12 * _sc, sx = (_sw - totalW) / 2;
  for (var i = 0; i < items.length; i++) {
    var it = items[i], bx = sx + i * (bw + 12 * _sc);
    var active = state.activePower === it.type, empty = state[it.type + 'Count'] <= 0;
    ctx.globalAlpha = empty ? 0.35 : 1;
    ctx.fillStyle = active ? C.POWER_ACTIVE_BG : '#ffffff';
    roundRect(ctx, bx, y, bw, bh, 20 * _sc); ctx.fill();
    ctx.strokeStyle = active ? C.POWER_ACTIVE_BORDER : C.POWER_BORDER; ctx.lineWidth = 2 * _sc;
    roundRect(ctx, bx, y, bw, bh, 20 * _sc); ctx.stroke();
    ctx.fillStyle = C.TITLE_COLOR; ctx.font = (22 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(it.label, bx + bw / 2, y + bh / 2); ctx.globalAlpha = 1;
  }
}

// ─── Hint ─────────────────────────────────────────────────

function drawHint() {
  var ctx = _ctx, y = (C.HEADER_H + C.CONTROL_H + C.UPGRADE_H) * _sc;
  ctx.fillStyle = C.HINT_COLOR; ctx.font = (22 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(state.hintText, _sw / 2, y + 4 * _sc);
}

// ─── Board ────────────────────────────────────────────────

function drawBoard() {
  var ctx = _ctx, boardTop = C.BOARD_TOP * _sc - state.scrollY;
  var cellW = C.CELL_W * _sc, cellH = C.CELL_H * _sc, gap = C.GAP * _sc, rowH = C.ROW_H * _sc;
  var totalBoardW = C.COLS * cellW + (C.COLS - 1) * gap, boardLeft = (_sw - totalBoardW) / 2;
  var totalH = C.ROWS * rowH, visibleH = _sh - C.BOARD_TOP * _sc;
  state.maxScrollY = Math.max(0, totalH - visibleH);
  ctx.save(); ctx.beginPath(); ctx.rect(0, C.BOARD_TOP * _sc, _sw, visibleH); ctx.clip();
  for (var r = 0; r < C.ROWS; r++) {
    for (var c = 0; c < C.COLS; c++) {
      var cx = boardLeft + c * (cellW + gap), cy = boardTop + r * rowH;
      if (cy + cellH < C.BOARD_TOP * _sc || cy > _sh) continue;
      var key = r + ',' + c, phase = state.dropCells[key], offsetY = 0;
      if (phase === 'start') offsetY = -(r * C.ROW_H + 150) * _sc;
      drawCell(cx, cy + offsetY, cellW, cellH, state.grid[r][c], r, c);
    }
  }
  ctx.restore();
}

function drawCell(x, y, w, h, value, row, col) {
  var ctx = _ctx;
  fillCellBg(ctx, x, y, w, h, value);
  var hl = (state.swapCell && state.swapCell.row === row && state.swapCell.col === col) ||
           (state.supremePicker && state.supremePicker.row === row && state.supremePicker.col === col);
  if (hl) {
    ctx.save(); ctx.strokeStyle = C.SWAP_GLOW; ctx.lineWidth = 4 * _sc;
    ctx.shadowColor = C.SWAP_GLOW; ctx.shadowBlur = 12 * _sc;
    roundRect(ctx, x, y, w, h, 8 * _sc); ctx.stroke(); ctx.restore();
  }
  drawCellText(ctx, x, y, w, h, value);
}

// ─── Celebration ──────────────────────────────────────────

function drawCelebration() {
  if (!state.celebration) return;
  var elapsed = Date.now() - state.celebTime;
  var t = getCelebTransform(Math.min(1, elapsed / 900));
  var ctx = _ctx;
  ctx.save(); ctx.globalAlpha = t.alpha; ctx.translate(_sw / 2, _sh / 2); ctx.scale(t.scale, t.scale);
  ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.font = 'bold ' + (56 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(state.celebration, 2 * _sc, 2 * _sc);
  ctx.fillStyle = C.CELEB_COLOR;
  ctx.fillText(state.celebration, 0, 0);
  ctx.restore();
}

// ─── Game Over ────────────────────────────────────────────

function drawGameOver() {
  if (!state.gameOver) return;
  var ctx = _ctx;
  ctx.fillStyle = C.OVERLAY_BG; ctx.fillRect(0, 0, _sw, _sh);
  var bw = 380 * _sc, bh = 280 * _sc, bx = (_sw - bw) / 2, by = (_sh - bh) / 2;
  ctx.fillStyle = '#ffffff'; roundRect(ctx, bx, by, bw, bh, 12 * _sc); ctx.fill();
  ctx.fillStyle = C.TITLE_COLOR; ctx.font = 'bold ' + (48 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('游戏结束', _sw / 2, by + 70 * _sc);
  ctx.font = (32 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.fillText('得分: ' + state.score, _sw / 2, by + 140 * _sc);
  var btnW = 200 * _sc, btnH = 56 * _sc, btnX = (_sw - btnW) / 2, btnY = by + 190 * _sc;
  ctx.fillStyle = C.NEWGAME_BG; roundRect(ctx, btnX, btnY, btnW, btnH, 8 * _sc); ctx.fill();
  ctx.fillStyle = '#f9f6f2'; ctx.font = (28 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
  ctx.fillText('重新开始', _sw / 2, btnY + btnH / 2);
}

// ─── Menu ─────────────────────────────────────────────────

function drawMenu() {
  if (!state.showMenu) return;
  var ctx = _ctx;
  ctx.fillStyle = 'rgba(0,0,0,0.01)'; ctx.fillRect(0, 0, _sw, _sh);
  var mw = 280 * _sc, mx = _sw - 30 * _sc - mw, my = 100 * _sc, itemH = 56 * _sc;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 24 * _sc; ctx.shadowOffsetY = 6 * _sc;
  ctx.fillStyle = C.MENU_BG; roundRect(ctx, mx, my, mw, itemH * 4, 10 * _sc); ctx.fill(); ctx.restore();
  var items = [{ label: '音效', type: 'sfx' }, { label: '背景音乐', type: 'bgm' }, { label: '重新开始', type: 'restart' }];
  for (var i = 0; i < items.length; i++) {
    var iy = my + i * itemH, item = items[i];
    ctx.fillStyle = C.TITLE_COLOR; ctx.font = (28 * _sc) + 'px "Helvetica Neue",Arial,sans-serif';
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
  var ctx = _ctx, tw = 64 * _sc, th = 36 * _sc, kr = 14 * _sc;
  ctx.fillStyle = on ? C.TOGGLE_ON_BG : C.TOGGLE_OFF_BG; roundRect(ctx, x, y, tw, th, 18 * _sc); ctx.fill();
  var kx = on ? x + tw - 4 * _sc - kr * 2 : x + 4 * _sc;
  ctx.fillStyle = '#ffffff'; ctx.beginPath();
  ctx.arc(kx + kr, y + (th - kr * 2) / 2 + kr, kr, 0, Math.PI * 2); ctx.fill();
}

module.exports = { initRenderer: initRenderer, render: render };
