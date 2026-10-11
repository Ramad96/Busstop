import confetti from 'canvas-confetti';

export function celebrate(big: boolean) {
  const base = { disableForReducedMotion: true, zIndex: 50 };
  confetti({ ...base, particleCount: big ? 160 : 60, spread: big ? 100 : 70, origin: { y: 0.3 } });
  if (big) {
    setTimeout(
      () =>
        confetti({ ...base, particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.6 } }),
      250,
    );
    setTimeout(
      () =>
        confetti({ ...base, particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.6 } }),
      400,
    );
  }
}
