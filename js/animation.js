var tweens = [];
var pendingActions = [];
var _nextAnimId = 0;

function scheduleAction(delayMs, callback) {
  pendingActions.push({
    time: Date.now() + delayMs,
    callback: callback
  });
}

function addTween(type, data, durationMs) {
  tweens.push({
    id: _nextAnimId++,
    type: type,
    startTime: Date.now(),
    duration: durationMs,
    progress: 0,
    data: data
  });
}

function updateAnim(now) {
  var active = [];
  for (var i = 0; i < tweens.length; i++) {
    var t = tweens[i];
    t.progress = Math.min(1, (now - t.startTime) / t.duration);
    if (t.progress < 1) {
      active.push(t);
    }
  }
  tweens = active;
}

function processActions(now) {
  var remaining = [];
  for (var i = 0; i < pendingActions.length; i++) {
    if (now >= pendingActions[i].time) {
      pendingActions[i].callback();
    } else {
      remaining.push(pendingActions[i]);
    }
  }
  pendingActions = remaining;
}

function updateScrollInertia() {
  if (Math.abs(state.scrollVelocity) < 0.5) {
    state.scrollVelocity = 0;
    return;
  }
  state.scrollVelocity *= 0.92;
  state.scrollY -= state.scrollVelocity;
  if (state.scrollY < 0) state.scrollY = 0;
  if (state.scrollY > state.maxScrollY) state.scrollY = state.maxScrollY;
}

function easeOutQuad(t) { return t * (2 - t); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// Multi-keyframe celebration transform
function getCelebTransform(progress) {
  if (progress < 0.25) {
    var p = progress / 0.25;
    var s = 0.3 + 0.9 * easeOutQuad(p);
    return { scale: s, alpha: easeOutQuad(p) };
  } else if (progress < 0.5) {
    var p = (progress - 0.25) / 0.25;
    return { scale: 1.2 - 0.2 * p, alpha: 1 };
  } else {
    var p = (progress - 0.5) / 0.5;
    return { scale: 1.0 - 0.2 * easeOutQuad(p), alpha: 1 - easeOutQuad(p) };
  }
}
