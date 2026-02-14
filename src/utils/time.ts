const TIME = Object.freeze({
  secondsPerMinute: 60,
  padLength: 2,
});

export function formatTimer(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const minutes = Math.floor(safeSeconds / TIME.secondsPerMinute);
  const seconds = safeSeconds % TIME.secondsPerMinute;

  return `${String(minutes).padStart(TIME.padLength, '0')}:${String(seconds).padStart(TIME.padLength, '0')}`;
}
