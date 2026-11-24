// Neon Harbor — every sound is synthesized with WebAudio: no audio files, no network.
export function createAudio() {
  const audio = {
    ctx: null, master: null, musicGain: null, engineOsc: null, engineGain: null,
    sirenTimer: 0, sirenHigh: false, muted: false, musicOn: false, musicStep: 0, musicTimer: 0,
  };

  function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.musicGain = audio.ctx.createGain();
      audio.musicGain.gain.value = 0.16;
      audio.musicGain.connect(audio.master);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || audio.muted) return;
    try {
      const t = audio.ctx.currentTime;
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(audio.master);
      o.start(t); o.stop(t + dur + 0.02);
    } catch { /* sound is decoration; never break the game */ }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ensure() || audio.muted) return;
    try {
      const t = audio.ctx.currentTime;
      const len = Math.floor(audio.ctx.sampleRate * dur);
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const f = audio.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
      const g = audio.ctx.createGain();
      g.gain.setValueAtTime(vol || 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f); f.connect(g); g.connect(audio.master);
      src.start(t);
    } catch { /* ignore */ }
  }

  audio.unlock = ensure;
  audio.shoot = () => { noiseBurst(0.12, 0.4, 2500); tone(180, 0.08, 'square', 0.15, 60); };
  audio.punch = () => { noiseBurst(0.08, 0.3, 500); };
  audio.pickup = () => { tone(660, 0.08, 'sine', 0.2); setTimeout(() => tone(990, 0.1, 'sine', 0.2), 70); };
  audio.crash = () => { noiseBurst(0.25, 0.4, 700); tone(90, 0.2, 'sawtooth', 0.2, 40); };
  audio.click = () => tone(520, 0.05, 'sine', 0.15);
  audio.busted = () => { tone(440, 0.15, 'square', 0.2, 330); setTimeout(() => tone(330, 0.3, 'square', 0.2, 220), 150); };
  audio.jingle = () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.22), i * 110)); };
  audio.horn = () => { tone(370, 0.25, 'sawtooth', 0.15); tone(466, 0.25, 'sawtooth', 0.12); };

  // Engine hum: one oscillator whose pitch follows speed; call every frame while driving.
  audio.engine = (speedNorm, driving) => {
    if (!ensure() || audio.muted) { audio.engineStop(); return; }
    try {
      if (!driving) { audio.engineStop(); return; }
      if (!audio.engineOsc) {
        audio.engineOsc = audio.ctx.createOscillator();
        audio.engineGain = audio.ctx.createGain();
        audio.engineOsc.type = 'sawtooth';
        audio.engineGain.gain.value = 0.05;
        const f = audio.ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 900;
        audio.engineOsc.connect(f); f.connect(audio.engineGain); audio.engineGain.connect(audio.master);
        audio.engineOsc.start();
      }
      audio.engineOsc.frequency.setTargetAtTime(60 + speedNorm * 160, audio.ctx.currentTime, 0.05);
      audio.engineGain.gain.setTargetAtTime(0.03 + speedNorm * 0.05, audio.ctx.currentTime, 0.1);
    } catch { /* ignore */ }
  };
  audio.engineStop = () => {
    try {
      if (audio.engineOsc) { audio.engineOsc.stop(); audio.engineOsc = null; audio.engineGain = null; }
    } catch { audio.engineOsc = null; }
  };

  // Two-tone police siren, stepped in the game loop so it stays in sync with the chase.
  audio.siren = (on, dt) => {
    if (!on) return;
    audio.sirenTimer -= dt;
    if (audio.sirenTimer <= 0) {
      audio.sirenTimer = 0.42;
      audio.sirenHigh = !audio.sirenHigh;
      tone(audio.sirenHigh ? 720 : 540, 0.4, 'sine', 0.05);
    }
  };

  // A lazy bassline loop: root notes of a i–VI–III–VII walk in A minor, plus a hat tick.
  const BASS = [110, 87.31, 130.81, 98];
  audio.music = (dt) => {
    if (!audio.musicOn || audio.muted) return;
    if (!ensure()) return;
    audio.musicTimer -= dt;
    if (audio.musicTimer > 0) return;
    audio.musicTimer = 0.24;
    const step = audio.musicStep % 16;
    audio.musicStep += 1;
    const root = BASS[Math.floor(step / 4) % 4];
    if (step % 4 === 0) {
      try {
        const t = audio.ctx.currentTime;
        const o = audio.ctx.createOscillator();
        const g = audio.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = root;
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
        o.connect(g); g.connect(audio.musicGain);
        o.start(t); o.stop(t + 0.95);
      } catch { /* ignore */ }
    }
    if (step % 2 === 0) noiseBurst(0.03, 0.05, 6000);
  };
  audio.startMusic = () => { ensure(); audio.musicOn = true; };
  audio.setMuted = (m) => {
    audio.muted = m;
    if (m) audio.engineStop();
    if (audio.master) audio.master.gain.value = m ? 0 : 0.5;
  };
  return audio;
}
