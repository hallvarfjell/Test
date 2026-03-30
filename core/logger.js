// logger.js
export const Logger = {
  active: false,
  points: [],
  startTs: null,
  dist: 0,
  elev: 0,
  tss: 0,
};

export function startLogger() {}
export function stopLogger() {}
export function writeSample(ts) {}
export function computeLastWorkMetrics() {}
