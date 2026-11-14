/* Tiny WebAudio synth: chiptune-ish BGM loops + SFX. No audio files needed. */
window.AUDIO = (() => {
  let ctx = null, master, bgmBus, sfxBus, duck;
  let vol = { bgm: 0.5, sfx: 0.7 };
  let track = null, timer = null, step = 0, nextT = 0, pending;

  const N = n => {
    const m = /^([A-G])(#?)(\d)$/.exec(n); if (!m) return 0;
    const i = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (i + (+m[3] + 1) * 12 - 69) / 12);
  };
  // "C5 E5 G5 -" one token per 8th note; "~" holds previous
  const seq = s => s.trim().split(/\s+/);

  const TRACKS = {
    title: { bpm: 150, wave: 'square', lead: seq('E5 G5 A5 G5 E5 - C5 D5 E5 - G5 - A5 - - - F5 A5 C6 A5 G5 - E5 D5 C5 - D5 - E5 - - - E5 G5 A5 G5 E5 - C5 D5 E5 G5 C6 - B5 A5 G5 - F5 E5 D5 E5 F5 - A5 - G5 - E5 D5 C5 - - -'),
      bass: seq('C3 - C4 - A2 - A3 - F2 - F3 - G2 - G3 - C3 - C4 - A2 - A3 - F2 - G2 - C3 - C3 -'), drum: true },
    daily: { bpm: 126, wave: 'triangle', lead: seq('C5 - E5 G5 - E5 F5 - D5 - F5 A5 - F5 E5 - C5 - E5 G5 - C6 B5 - A5 - G5 F5 E5 - D5 -'),
      bass: seq('F3 - C4 - D3 - A3 - G3 - D4 - C3 - G3 - F3 - C4 - D3 - A3 - G3 - G3 - C3 - - -'), drum: true },
    romance: { bpm: 84, wave: 'sine', lead: seq('E5 ~ G5 ~ B5 ~ A5 ~ G5 ~ E5 ~ F#5 ~ ~ ~ D5 ~ F#5 ~ A5 ~ G5 ~ F#5 ~ E5 ~ ~ ~ ~ ~'),
      bass: seq('C3 G3 C4 G3 B2 G3 B3 G3 A2 E3 A3 E3 D3 A3 D4 A3'), arp: true },
    night: { bpm: 92, wave: 'sine', lead: seq('A4 ~ C5 ~ E5 ~ D5 C5 ~ ~ A4 ~ G4 ~ ~ ~ F4 ~ A4 ~ C5 ~ B4 A4 ~ ~ G4 ~ E4 ~ ~ ~'),
      bass: seq('F2 C3 F3 C3 E2 B2 E3 B2 D2 A2 D3 A2 G2 D3 G3 D3'), arp: true },
    tension: { bpm: 100, wave: 'sawtooth', lead: seq('- - - - E4 - - - - - - - F4 - E4 - - - - - E4 - - - - - G4 - F4 - E4 -'),
      bass: seq('A1 A1 - A1 A1 - A1 - A1 A1 - A1 G1 - G#1 -'), drum: false },
    sad: { bpm: 70, wave: 'sine', lead: seq('A4 ~ ~ ~ C5 ~ B4 ~ A4 ~ ~ ~ E4 ~ ~ ~ F4 ~ ~ ~ A4 ~ G4 ~ E4 ~ ~ ~ ~ ~ ~ ~'),
      bass: seq('A2 E3 A3 E3 F2 C3 F3 C3 D2 A2 D3 A2 E2 B2 E3 B2'), arp: true },
    ending: { bpm: 104, wave: 'triangle', lead: seq('G5 ~ E5 ~ C5 ~ E5 G5 C6 ~ B5 ~ A5 ~ G5 ~ A5 ~ F5 ~ D5 ~ F5 A5 B5 ~ A5 ~ G5 ~ ~ ~'),
      bass: seq('C3 G3 E3 G3 A2 E3 C3 E3 F2 C3 A2 C3 G2 D3 B2 D3'), arp: true },
  };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    duck = ctx.createGain(); duck.gain.value = 1; duck.connect(master);
    bgmBus = ctx.createGain(); bgmBus.gain.value = vol.bgm * 0.22; bgmBus.connect(duck);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx * 0.5; sfxBus.connect(master);
    if (pending !== undefined) { const p = pending; pending = undefined; bgm(p); }
  }

  function tone(f, t, d, type, g, bus, a = 0.01) {
    if (!ctx || !f) return;
    const o = ctx.createOscillator(), v = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + a); v.gain.exponentialRampToValueAtTime(0.0008, t + d);
    o.connect(v); v.connect(bus); o.start(t); o.stop(t + d + 0.05);
    return o;
  }
  function noise(t, d, g, bus, hp = 6000) {
    if (!ctx) return;
    const b = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * d), ctx.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), v = ctx.createGain();
    f.type = 'highpass'; f.frequency.value = hp; s.buffer = b;
    v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(0.0008, t + d);
    s.connect(f); f.connect(v); v.connect(bus); s.start(t);
  }

  function lenOf(arr, i) { let n = 1; while (arr[(i + n) % arr.length] === '~' && n < arr.length) n++; return n; }

  function schedule() {
    if (!track || !ctx) return;
    const T = TRACKS[track], spb = 60 / T.bpm / 2;
    while (nextT < ctx.currentTime + 0.25) {
      const li = step % T.lead.length, bi = step % T.bass.length;
      const ln = T.lead[li];
      if (ln !== '-' && ln !== '~') tone(N(ln), nextT, spb * lenOf(T.lead, li) * 0.95, T.wave, T.wave === 'square' ? 0.18 : 0.32, bgmBus);
      const bn = T.bass[bi];
      if (bn !== '-' && bn !== '~') tone(N(bn), nextT, spb * (T.arp ? 1.6 : 0.9), T.arp ? 'triangle' : 'triangle', T.arp ? 0.22 : 0.3, bgmBus);
      if (T.drum) {
        if (step % 4 === 0) tone(110, nextT, 0.12, 'sine', 0.5, bgmBus, 0.002);
        if (step % 2 === 1) noise(nextT, 0.04, 0.12, bgmBus);
      }
      step++; nextT += spb;
    }
  }

  function bgm(name) {
    if (!ctx) { pending = name; return; }
    if (name === track) return;
    track = TRACKS[name] ? name : null;
    step = 0; nextT = ctx.currentTime + 0.08;
    if (!timer) timer = setInterval(schedule, 60);
  }

  const SFX = {
    alarm: t => { for (let i = 0; i < 6; i++) tone(i % 2 ? 1760 : 1320, t + i * 0.13, 0.1, 'square', 0.25, sfxBus); },
    step: t => { for (let i = 0; i < 4; i++) noise(t + i * 0.22, 0.07, 0.35, sfxBus, 800); },
    tap: t => { tone(900, t, 0.06, 'sine', 0.5, sfxBus); tone(900, t + 0.12, 0.06, 'sine', 0.5, sfxBus); },
    buzz: t => { for (let i = 0; i < 2; i++) tone(80, t + i * 0.3, 0.22, 'sawtooth', 0.25, sfxBus, 0.005); },
    kakao: t => { tone(1318, t, 0.12, 'sine', 0.4, sfxBus); tone(1760, t + 0.1, 0.25, 'sine', 0.4, sfxBus); },
    msg: t => { tone(1046, t, 0.1, 'triangle', 0.4, sfxBus); tone(1568, t + 0.08, 0.2, 'triangle', 0.35, sfxBus); },
    drop: t => { noise(t, 0.25, 0.5, sfxBus, 300); tone(200, t, 0.2, 'triangle', 0.4, sfxBus); },
    put: t => { tone(300, t, 0.08, 'triangle', 0.5, sfxBus, 0.002); noise(t, 0.05, 0.2, sfxBus, 1500); },
    heart: t => { [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.06, 0.18, 'sine', 0.28, sfxBus)); },
    heart2: t => { [784, 1046, 1318, 1568, 2093, 2637].forEach((f, i) => tone(f, t + i * 0.05, 0.22, 'triangle', 0.25, sfxBus)); },
    select: t => { tone(1568, t, 0.08, 'square', 0.15, sfxBus); tone(2093, t + 0.06, 0.12, 'square', 0.15, sfxBus); },
    major: t => { tone(110, t, 1.1, 'sawtooth', 0.3, sfxBus, 0.02); tone(164.8, t, 1.1, 'sawtooth', 0.2, sfxBus, 0.02); noise(t, 0.6, 0.15, sfxBus, 200); },
    item: t => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.09, 0.3, 'square', 0.16, sfxBus)); },
    shock: t => { tone(880, t, 0.08, 'square', 0.3, sfxBus); tone(440, t + 0.07, 0.25, 'square', 0.3, sfxBus); },
    page: t => { noise(t, 0.18, 0.25, sfxBus, 2500); },
    door: t => { tone(659, t, 0.25, 'sine', 0.35, sfxBus); tone(523, t + 0.22, 0.4, 'sine', 0.35, sfxBus); },
    engine: t => { tone(55, t, 1.2, 'sawtooth', 0.15, sfxBus, 0.2); },
    coin: t => { tone(1975, t, 0.08, 'square', 0.2, sfxBus); tone(2637, t + 0.08, 0.3, 'square', 0.2, sfxBus); },
    sad: t => { tone(392, t, 0.4, 'triangle', 0.3, sfxBus); tone(330, t + 0.3, 0.6, 'triangle', 0.3, sfxBus); },
    clack: t => { noise(t, 0.05, 0.6, sfxBus, 2500); tone(1800, t + 0.05, 0.05, 'square', 0.2, sfxBus, 0.001); tone(3520, t + 0.16, 0.12, 'sine', 0.3, sfxBus, 0.001); },   // 철컥! 팅!
    jam: t => { for (let i = 0; i < 6; i++) noise(t + i * 0.05, 0.04, 0.35, sfxBus, 900); noise(t + 0.34, 0.06, 0.5, sfxBus, 2500); },   // 드르륵! 철컥!
    scan: t => { const o = tone(300, t, 0.9, 'sawtooth', 0.12, sfxBus, 0.1); if (o) o.frequency.linearRampToValueAtTime(900, t + 0.8); },   // 위이잉—
    beep: t => { tone(2637, t, 0.09, 'square', 0.18, sfxBus, 0.002); },   // 삑!
    beep2: t => { tone(2637, t, 0.07, 'square', 0.18, sfxBus, 0.002); tone(2637, t + 0.11, 0.09, 'square', 0.18, sfxBus, 0.002); },   // 삐빅!
    blip: t => { tone(1400 + Math.random() * 300, t, 0.03, 'square', 0.05, sfxBus, 0.001); },
  };

  function sfx(name) { if (!ctx || !SFX[name]) return; SFX[name](ctx.currentTime + 0.01); }

  function duckTo(v, dur = 0.3) { if (!ctx) return; duck.gain.cancelScheduledValues(ctx.currentTime); duck.gain.linearRampToValueAtTime(v, ctx.currentTime + dur); }
  function setVol(kind, v) {
    vol[kind] = v;
    if (!ctx) return;
    if (kind === 'bgm') bgmBus.gain.value = v * 0.22; else sfxBus.gain.value = v * 0.5;
  }
  return { init, bgm, sfx, duck: duckTo, setVol, get track() { return track; } };
})();
