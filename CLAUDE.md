# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

WeChat Mini-Program (微信小程序) number merge game. Single-page app at `pages/index/index`. Numbers drop into a 11×6 grid, adjacent same-value numbers merge (2048-style), and chain reactions trigger bonus drops and surprise effects.

## Commands

No build/lint/test commands. This is a WeChat mini-program opened directly in the WeChat Developer Tools (微信开发者工具). Simply open the project root in the IDE and click compile.

## WeChat compatibility constraints (CRITICAL)

The WeChat mini-program JS engine (WAServiceMainContext) is limited. **All JS in `pages/` and `utils/` must follow these rules:**

- **Use `var` only** — no `const`, no `let`. Block-scoped declarations cause runtime failures.
- **Use `function` keyword** — no arrow functions. Use `var self = this;` pattern for callbacks.
- **Use string concatenation** — no template literals. Use `'text ' + value` not `` `text ${value}` ``.
- **Use plain objects `{}`** — no `Map`, no `Set`. Use `obj[key] = true` for sets, `Object.keys(obj)` to iterate.
- **`setData()` is asynchronous** — when calling `buildDisplayGrid()` inside a `setData()` call, the grid builder reads `this.data.*` which hasn't been updated yet. Always set `this.data.xxx = newValue` **before** `setData()` if `buildDisplayGrid()` depends on that value.
- **Inline `animation` CSS in `style` attribute does not work** — use CSS class-based animations (`extraClass` field) and define `@keyframes` in the WXSS.
- **Audio files must exist before calling `play()`** — use `wx.getFileSystemManager().accessSync(path)` to check. Missing files cause framework-level timeout errors.
- **Lazy-load audio module** — never `require('../../utils/audio')` at module top-level. Use a lazy getter function called from `onLoad` or later.

## Architecture: two-layer grid

The game maintains two separate grid representations:

1. **`this.grid`** (raw): 2D array of numbers `[[0,2,0,...], ...]`. All game logic operates on this.
2. **`this.data.grid`** (display): Array of cell objects `[{value, style, extraClass, merging}, ...]`. Built by `buildDisplayGrid()` and sent to WXML via `setData`.

Key state fields on `this` (not in data):
- `this.dropCells` — object `{"row,col": 'start'|'fall'}` for current drop animations
- `this.mergeCells` — object `{"row,col": true}` for current merge pop targets
- `this._showMerge` / `this._mergePop` — animation phase flags
- `this._activeCol` — column where the player last dropped (controls horizontal merge direction)
- `this.score` — current score (mirrored to `this.data.score` on setData)

## Game logic flow

1. **`placeNumber(col, value)`**: Finds bottom-most empty row in column → places value → calls `processMerges()` (directional DFS: down, up, left, right) → `applyGravity()` (column compaction) → `while (scanAndMerge())` loop (global sweep: vertical then horizontal, horizontal merges toward `_activeCol`).

2. **`processMerges(row, col)`**: Recursive. Checks 4 directions for same-value neighbors; on match, doubles current cell, clears neighbor, recurses on same cell with new value. Returns after first match (one merge per call).

3. **Bonus chain**: After main drop, `mergeCount >= 3` triggers `spawnBonuses()` which places N random numbers in random non-full columns. Bonus drops can recursively trigger more bonuses.

4. **Surprise mode**: 20% chance per bonus wave. Four equal-probability effects: fill empty cells with 2, upgrade smallest number, rain 3×5 drops, fill entire board randomly.

## Animation system

`runWave(callback, speed)` — three-phase setTimeout chain:
- Phase 1 (0ms): Render with `translateY(-offset)` + `transition:none` (number appears above board)
- Phase 2 (50/speed ms): Switch to `translateY(0)` + `transition:transform` (number slides down)
- Phase 3 (300/speed ms): Clear drop cells, set `_showMerge=true`, play merge pop on `mergeCells`
- Phase 4 (800/speed ms): `clearAnimations()`, then callback

Drop offset = `-(row * ROW_H + 150)` rpx. Speed parameter divides all delays.

## Audio

`utils/audio.js` — singleton `AudioManager` class. Lazy-loaded via `getAudio()` helper. Checks file existence with `accessSync` before creating audio contexts. BGM loops, SFX creates per-play contexts destroyed on end/error. Paths: `/assets/audio/背景音乐.mp3`, `/assets/audio/drop.mp3`, `/assets/audio/merge.mp3`.

## Power-ups

Six power-ups stored in `data` with count fields:

| Data field | Default | Behavior |
|---|---|---|
| `wandCount` | 3 | Tap cell → random 2-64 transform |
| `swapCount` | 3 | Tap two cells → swap values + auto-merge |
| `clearCount` | 3 | Tap cell → remove + auto-merge chain |
| `supremeWandCount` | 1 | Tap cell → show 5-option picker (×2 to ×32) → all matching cells transform + merge |
| `dragonHandCount` | 1 | 20 auto-drops at 2-3 per wave, 3× speed, smart column targeting |
| `immortalCount` | 1 | Fill board with random numbers → animated rain → recursive merge chain |

`activePower` tracks which is active. When `supremePicker` is set, the control row is replaced by a number selector and normal drops are blocked.
