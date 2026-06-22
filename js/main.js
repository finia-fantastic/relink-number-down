var stateModule = require('./state.js');
var state = stateModule.state;
var initState = stateModule.initState;
var audio = require('./audio.js');
var renderer = require('./renderer.js');
var input = require('./input.js');
var anim = require('./animation.js');
var GL = require('./game-logic.js');

function init() {
  var sysInfo = wx.getSystemInfoSync();
  var dpr = sysInfo.pixelRatio || 2;
  var screenW = sysInfo.windowWidth;
  var screenH = sysInfo.windowHeight;

  var canvas = wx.createCanvas();
  canvas.width = screenW * dpr;
  canvas.height = screenH * dpr;

  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  initState();
  audio.init();
  renderer.initRenderer(ctx, screenW, screenH);
  input.initInput(screenW);
  state.currentNumber = GL.generateNumber();

  wx.onShow(function() { if (audio.bgmEnabled) audio.playBgm(); });
  wx.onHide(function() { audio.pauseBgm(); });

  requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
  var now = timestamp || Date.now();
  anim.updateAnim(now);
  anim.processActions(now);
  anim.updateScrollInertia();
  renderer.render();
  requestAnimationFrame(gameLoop);
}

module.exports = { init: init };
