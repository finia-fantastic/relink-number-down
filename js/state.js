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
  state._touchStartY = 0;
  state._scrollStartY = 0;
  state._isScrolling = false;
  state._lastScrollDy = 0;
  state._lastScrollTime = 0;
}
