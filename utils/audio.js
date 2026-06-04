const BGM_PATH = '/assets/audio/背景音乐.mp3';
const DROP_PATH = '/assets/audio/drop.mp3';
const MERGE_PATH = '/assets/audio/merge.mp3';

class AudioManager {
  constructor() {
    this.sfxEnabled = true;
    this.bgmEnabled = false;
    this.bgm = null;

    try {
      const prefs = wx.getStorageSync('audioPrefs');
      if (prefs) {
        this.sfxEnabled = prefs.sfxEnabled !== false;
        this.bgmEnabled = prefs.bgmEnabled === true;
      }
    } catch (e) {
      // No saved prefs yet
    }
  }

  _savePrefs() {
    wx.setStorage({
      key: 'audioPrefs',
      data: { sfxEnabled: this.sfxEnabled, bgmEnabled: this.bgmEnabled }
    });
  }

  _ensureBgm() {
    if (this.bgm) return;
    try {
      wx.getFileSystemManager().accessSync(BGM_PATH);
    } catch (e) {
      return; // File doesn't exist
    }
    this.bgm = wx.createInnerAudioContext();
    this.bgm.src = BGM_PATH;
    this.bgm.loop = true;
    this.bgm.volume = 0.4;
    this.bgm.onError(function() {});
  }

  playBgm() {
    if (!this.bgmEnabled) return;
    this._ensureBgm();
    if (this.bgm) this.bgm.play();
  }

  pauseBgm() {
    if (this.bgm) this.bgm.pause();
  }

  playDrop() {
    if (!this.sfxEnabled) return;
    this._play(DROP_PATH);
  }

  playMerge() {
    if (!this.sfxEnabled) return;
    this._play(MERGE_PATH);
  }

  _play(src) {
    try {
      wx.getFileSystemManager().accessSync(src);
    } catch (e) {
      return; // File doesn't exist — skip silently
    }
    var ctx = wx.createInnerAudioContext();
    ctx.src = src;
    ctx.volume = 0.6;
    ctx.onEnded(function() { ctx.destroy(); });
    ctx.onError(function() { ctx.destroy(); });
    ctx.play();
  }

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    this._savePrefs();
    return this.sfxEnabled;
  }

  toggleBgm() {
    this.bgmEnabled = !this.bgmEnabled;
    this._savePrefs();
    if (this.bgmEnabled) {
      this.playBgm();
    } else {
      this.pauseBgm();
    }
    return this.bgmEnabled;
  }

  destroy() {
    if (this.bgm) {
      this.bgm.destroy();
      this.bgm = null;
    }
  }
}

module.exports = new AudioManager();
