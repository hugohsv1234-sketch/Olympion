let context: AudioContext | undefined;
export function moveSound() {
  try {
    context ??= new AudioContext();
    void context.resume();
    const tone = context.createOscillator(),
      gain = context.createGain();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(420, context.currentTime);
    tone.frequency.exponentialRampToValueAtTime(190, context.currentTime + 0.06);
    gain.gain.setValueAtTime(0.045, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.075);
    tone.connect(gain);
    gain.connect(context.destination);
    tone.start();
    tone.stop(context.currentTime + 0.08);
  } catch {
    /* Sound is optional; a blocked audio context never prevents a move. */
  }
}
