// js/timer.js

import { getState, updateState } from "./state.js";

let rafId = null;

function now() {
  return performance.now();
}

function tick() {
  const state = getState();
  const timer = state.timer;

  if (!timer.running || !timer.lastStartTs) return;

  const elapsedMs = now() - timer.lastStartTs;
  const elapsedSeconds = elapsedMs / 1000;

  updateState({
    timer: {
      seconds: timer.seconds + elapsedSeconds,
      lastStartTs: now()
    }
  });

  rafId = requestAnimationFrame(tick);
}

// ▶ Start timer
export function startTimer() {
  const { timer } = getState();
  if (timer.running) return;

  updateState({
    timer: {
      running: true,
      lastStartTs: now()
    }
  });

  rafId = requestAnimationFrame(tick);
}

// ⏸ Pause timer
export function pauseTimer() {
  const { timer } = getState();
  if (!timer.running) return;

  updateState({
    timer: {
      running: false,
      lastStartTs: null
    }
  });

  if (rafId) cancelAnimationFrame(rafId);
}

// 🔄 Reset timer
export function resetTimer() {
  if (rafId) cancelAnimationFrame(rafId);

  updateState({
    timer: {
      seconds: 0,
      running: false,
      extraTime: 0,
      lastStartTs: null
    }
  });
}

// ➕ Add extra time
export function addExtraTime(minutes) {
  const { timer } = getState();
  updateState({
    timer: {
      extraTime: timer.extraTime + minutes * 60
    }
  });
}