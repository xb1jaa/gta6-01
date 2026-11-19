// Procedural sound, no audio files: every effect is synthesised with WebAudio
// oscillators and filtered noise, and the car engine is a live oscillator whose
// pitch follows speed. Audio starts only after a user gesture.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function noiseBuffer(duration) {
    const c = ensure();
    if (!c) return null;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * duration), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function blip(freq, duration, type = 'sine', volume = 0.15, slideTo = 0) {
    const c = ensure();
    if (!c || muted) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + duration);
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  }

  function noiseBurst(duration, volume, filterFreq) {
    const c = ensure();
    if (!c || muted) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(duration);
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    shoot() { noiseBurst(0.12, 0.5, 2800); blip(180, 0.08, 'square', 0.12, 60); },
    punch() { noiseBurst(0.08, 0.3, 900); },
    pickup() { blip(660, 0.09, 'sine', 0.18); setTimeout(() => blip(990, 0.12, 'sine', 0.18), 90); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.2), i * 110));
    },
    busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.14), i * 160)); },
    click() { blip(880, 0.05, 'sine', 0.12); },
    carDoor() { noiseBurst(0.1, 0.25, 1200); blip(140, 0.1, 'square', 0.1, 90); },
    crash() { noiseBurst(0.25, 0.5, 700); },
    /** speed 0..1, on/off: the engine hum that follows the car. */
    engine(speed, on) {
      const c = ensure();
      if (!c) return;
      if (!on) {
        if (engineGain) engineGain.gain.setTargetAtTime(0, c.currentTime, 0.1);
        return;
      }
      if (!engineOsc) {
        engineOsc = c.createOscillator();
        engineGain = c.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 60;
        engineGain.gain.value = 0;
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        engineOsc.connect(filter).connect(engineGain).connect(c.destination);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(55 + speed * 130, c.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(muted ? 0 : 0.045 + speed * 0.05, c.currentTime, 0.1);
    },
    /** wanted > 0: a two-tone siren that wails while the police are after you. */
    siren(on, dt) {
      const c = ensure();
      if (!c) return;
      if (!on) {
        if (sirenGain) sirenGain.gain.setTargetAtTime(0, c.currentTime, 0.2);
        return;
      }
      if (!sirenOsc) {
        sirenOsc = c.createOscillator();
        sirenGain = c.createGain();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 700;
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain).connect(c.destination);
        sirenOsc.start();
      }
      sirenTimer += dt;
      const phase = (sirenTimer % 1.2) < 0.6 ? 700 : 950;
      sirenOsc.frequency.setTargetAtTime(phase, c.currentTime, 0.05);
      sirenGain.gain.setTargetAtTime(muted ? 0 : 0.03, c.currentTime, 0.2);
    },
  };
}
