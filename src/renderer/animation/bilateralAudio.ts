/**
 * Audio bilateral stimulation: a short, soft tone panned fully left or right each time the dot
 * reaches a side. Generated locally with Web Audio; nothing is loaded from disk or network.
 */
export type BilateralSide = "left" | "right";

let context: AudioContext | null = null;

function audioContext() {
  if (!context) context = new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

export function playBilateralTone(side: BilateralSide) {
  const ctx = audioContext();
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner();

  oscillator.type = "sine";
  oscillator.frequency.value = 432;
  panner.pan.value = side === "left" ? -1 : 1;
  // Gentle attack and release so the tone never clicks.
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

  oscillator.connect(gain).connect(panner).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.34);
}
