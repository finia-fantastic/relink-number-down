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

module.exports = {
  ROWS: ROWS, COLS: COLS,
  CELL_W: CELL_W, CELL_H: CELL_H, GAP: GAP, ROW_H: ROW_H,
  SPAWN_VALUES: SPAWN_VALUES, WAND_VALUES: WAND_VALUES,
  CELL_COLORS: CELL_COLORS,
  TEXT_DARK: TEXT_DARK, TEXT_LIGHT: TEXT_LIGHT,
  getTextColor: getTextColor, getFontSize: getFontSize,
  BG_COLOR: BG_COLOR, HEADER_BG: HEADER_BG, HEADER_TEXT: HEADER_TEXT,
  TITLE_COLOR: TITLE_COLOR, HINT_COLOR: HINT_COLOR, OVERLAY_BG: OVERLAY_BG,
  MENU_BG: MENU_BG, POWER_BORDER: POWER_BORDER,
  POWER_ACTIVE_BORDER: POWER_ACTIVE_BORDER, POWER_ACTIVE_BG: POWER_ACTIVE_BG,
  TOGGLE_ON_BG: TOGGLE_ON_BG, TOGGLE_OFF_BG: TOGGLE_OFF_BG,
  CELEB_COLOR: CELEB_COLOR, SWAP_GLOW: SWAP_GLOW, NEWGAME_BG: NEWGAME_BG,
  HEADER_PAD_TOP: HEADER_PAD_TOP, HEADER_H: HEADER_H,
  CONTROL_H: CONTROL_H, UPGRADE_H: UPGRADE_H, HINT_H: HINT_H,
  BOARD_TOP: BOARD_TOP, DESIGN_W: DESIGN_W,
  BGM_PATH: BGM_PATH, DROP_PATH: DROP_PATH, MERGE_PATH: MERGE_PATH
};
