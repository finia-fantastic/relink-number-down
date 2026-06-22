var canvas = null;
var ctx = null;
var screenW = 0;
var screenH = 0;

function init() {
  // Canvas setup
  var sysInfo = wx.getSystemInfoSync();
  var dpr = sysInfo.pixelRatio || 2;
  screenW = sysInfo.windowWidth;
  screenH = sysInfo.windowHeight;

  canvas = wx.createCanvas();
  canvas.width = screenW * dpr;
  canvas.height = screenH * dpr;

  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Init all subsystems
  initState();
  audio.init();
  initRenderer(ctx, screenW, screenH);
  initInput();

  state.currentNumber = generateNumber();

  // Start game loop
  requestAnimationFrame(gameLoop);

  // Lifecycle
  wx.onShow(function() {
    if (audio.bgmEnabled) audio.playBgm();
  });
  wx.onHide(function() {
    audio.pauseBgm();
  });
}

function gameLoop(timestamp) {
  var now = timestamp || Date.now();

  updateAnim(now);
  processActions(now);
  updateScrollInertia();
  render();

  requestAnimationFrame(gameLoop);
}
