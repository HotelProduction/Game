export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private volumes = { master: 0.8, music: 0.7, sfx: 0.9 };
  private muted = false;
  private ambienceStarted = false;
  private nextRandomEventAt = 0;

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();

    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.applyVolumes();
    this.startAmbience();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumes();
  }

  isMuted(): boolean {
    return this.muted;
  }

  pauseLoops(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  resumeLoops(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const masterTarget = this.muted ? 0 : this.volumes.master;
    this.masterGain.gain.setTargetAtTime(masterTarget, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.volumes.music, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.volumes.sfx, t, 0.05);
  }

  setVolumes(v: { master?: number; music?: number; sfx?: number }): void {
    if (v.master !== undefined) this.volumes.master = v.master;
    if (v.music !== undefined) this.volumes.music = v.music;
    if (v.sfx !== undefined) this.volumes.sfx = v.sfx;
    this.applyVolumes();
  }

  private createNoiseBuffer(durationSec = 2): AudioBuffer {
    const sampleRate = this.ctx!.sampleRate;
    const len = Math.floor(sampleRate * durationSec);
    const buffer = this.ctx!.createBuffer(1, len, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private startAmbience(): void {
    if (this.ambienceStarted || !this.ctx || !this.musicGain) return;
    this.ambienceStarted = true;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.value = 41;
    osc2.type = 'sine';
    osc2.frequency.value = 61.5;

    filter.type = 'lowpass';
    filter.frequency.value = 140;
    gain.gain.value = 0.14;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc1.start();
    osc2.start();

    const hum = this.ctx.createOscillator();
    const humGain = this.ctx.createGain();
    hum.type = 'triangle';
    hum.frequency.value = 120;
    humGain.gain.value = 0.022;
    hum.connect(humGain);
    humGain.connect(this.musicGain);
    hum.start();

    const vent = this.ctx.createBufferSource();
    vent.buffer = this.createNoiseBuffer(3);
    vent.loop = true;
    const ventFilter = this.ctx.createBiquadFilter();
    ventFilter.type = 'bandpass';
    ventFilter.frequency.value = 260;
    ventFilter.Q.value = 2.0;
    const ventGain = this.ctx.createGain();
    ventGain.gain.value = 0.032;
    vent.connect(ventFilter);
    ventFilter.connect(ventGain);
    ventGain.connect(this.musicGain);
    vent.start();
  }

  playFootstep(sprinting = false, phantom = false): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.14);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const baseFreq = phantom ? 350 : sprinting ? 720 : 500;
    filter.frequency.value = baseFreq * (0.92 + Math.random() * 0.16);

    const gain = this.ctx.createGain();
    const vol = phantom ? 0.11 : sprinting ? 0.2 : 0.12;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.13);
  }

  playDoorCreak(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(175, t);
    osc.frequency.linearRampToValueAtTime(240, t + 0.25);
    osc.frequency.linearRampToValueAtTime(140, t + 0.55);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 6;

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.58);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  playClick(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(920 * (0.94 + Math.random() * 0.12), t);
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.045);
  }

  playPickup(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(780, t + 0.12);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  playWhisper(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(1.4);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.linearRampToValueAtTime(2200, t + 0.7);
    filter.frequency.linearRampToValueAtTime(900, t + 1.3);
    filter.Q.value = 8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 1.4);
  }

  playChildLaugh(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const notes = [680, 620, 710, 580, 510];
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      const st = t + i * 0.16;
      osc.frequency.setValueAtTime(freq, st);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, st + 0.12);
      gain.gain.setValueAtTime(0.001, st);
      gain.gain.linearRampToValueAtTime(0.06, st + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.13);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(st);
      osc.stop(st + 0.14);
    });
  }

  playMonsterStinger(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    [110, 117, 233, 466].forEach((f) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.9);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 1.0);
    });
  }

  playRadioClue(sequence: Array<'A' | 'B' | 'C'>): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(1.8);
    const ng = this.ctx.createGain();
    ng.gain.value = 0.07;
    noise.connect(ng);
    ng.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 1.8);

    const map: Record<'A' | 'B' | 'C', number> = { A: 440, B: 660, C: 880 };
    sequence.forEach((letter, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = t + 0.25 + i * 0.45;
      osc.type = 'sine';
      osc.frequency.value = map[letter] || 520;
      gain.gain.setValueAtTime(0.15, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(st);
      osc.stop(st + 0.32);
    });
  }

  playCameraShutter(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(0.09);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    noise.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.09);
  }

  playHeartbeat(fearLevel: number): void {
    if (!this.ctx || !this.sfxGain || fearLevel < 55) return;
    const t = this.ctx.currentTime;
    [0, 0.22].forEach((offset) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(62, t + offset);
      osc.frequency.exponentialRampToValueAtTime(34, t + offset + 0.14);
      gain.gain.setValueAtTime(0.16 * (fearLevel / 100), t + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.16);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t + offset);
      osc.stop(t + offset + 0.17);
    });
  }

  updateAmbientHorror(nowMs: number, fearLevel: number): void {
    if (!this.ctx || this.muted) return;
    if (nowMs > this.nextRandomEventAt) {
      this.nextRandomEventAt = nowMs + 11000 + Math.random() * 14000;
      const roll = Math.random();
      if (roll < 0.35) this.playWhisper();
      else if (roll < 0.55) this.playChildLaugh();
      else if (fearLevel > 55) this.playFootstep(false, true);
    }
  }
}
