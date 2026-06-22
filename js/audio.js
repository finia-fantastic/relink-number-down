var C = require('./constants.js');

var audio = {
  sfxEnabled: true,
  bgmEnabled: false,
  _bgm: null,

  init: function() {
    var prefs = null;
    try { prefs = wx.getStorageSync('audioPrefs'); } catch (e) {}
    if (prefs) {
      this.sfxEnabled = prefs.sfxEnabled !== false;
      this.bgmEnabled = prefs.bgmEnabled === true;
    }
  },

  _save: function() {
    try { wx.setStorageSync('audioPrefs', { sfxEnabled: this.sfxEnabled, bgmEnabled: this.bgmEnabled }); } catch (e) {}
  },

  _fileExists: function(path) {
    try { wx.getFileSystemManager().accessSync(path); return true; } catch (e) { return false; }
  },

  _playSfx: function(path) {
    if (!this.sfxEnabled) return;
    if (!this._fileExists(path)) return;
    var ctx = wx.createInnerAudioContext();
    ctx.src = path;
    ctx.volume = 0.6;
    ctx.onEnded(function() { ctx.destroy(); });
    ctx.onError(function() { ctx.destroy(); });
    ctx.play();
  },

  playBgm: function() {
    if (!this.bgmEnabled) return;
    if (!this._fileExists(C.BGM_PATH)) return;
    if (!this._bgm) {
      this._bgm = wx.createInnerAudioContext();
      this._bgm.src = C.BGM_PATH;
      this._bgm.loop = true;
      this._bgm.volume = 0.4;
    }
    this._bgm.play();
  },

  pauseBgm: function() { if (this._bgm) this._bgm.pause(); },

  playDrop:  function() { this._playSfx(C.DROP_PATH); },
  playMerge: function() { this._playSfx(C.MERGE_PATH); },

  toggleSfx: function() { this.sfxEnabled = !this.sfxEnabled; this._save(); },
  toggleBgm: function() {
    this.bgmEnabled = !this.bgmEnabled; this._save();
    if (this.bgmEnabled) this.playBgm(); else this.pauseBgm();
  }
};

module.exports = audio;
