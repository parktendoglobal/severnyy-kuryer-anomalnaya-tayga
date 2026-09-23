// Web Audio API procedural sound synthesizer for "Северный Курьер"
import { WeatherType } from '../types/game';

interface WeatherWindProfile {
  masterVolume: number;
  rumbleGain: number;
  rumbleFreq: number;
  howlGain: number;
  howlFreq: number;
  howlQ: number;
  shimmerGain: number;
  shimmerFreq: number;
  auroraGain: number;
  stormGain: number;
  gustPeriodMs: number;
}

class SoundSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  // Master & layer nodes for dynamic wind loop
  private windMasterGain: GainNode | null = null;
  private windGain: GainNode | null = null; // Alias for backward compatibility
  private windFilter: BiquadFilterNode | null = null; // Alias for backward compatibility

  // Individual wind sonic layers for crossfading
  private windRumbleGain: GainNode | null = null;
  private windRumbleFilter: BiquadFilterNode | null = null;

  private windHowlGain: GainNode | null = null;
  private windHowlFilter: BiquadFilterNode | null = null;

  private windShimmerGain: GainNode | null = null;
  private windShimmerFilter: BiquadFilterNode | null = null;

  private windAuroraGain: GainNode | null = null;
  private windAuroraFilter: BiquadFilterNode | null = null;

  private windStormGain: GainNode | null = null;
  private windStormFilter: BiquadFilterNode | null = null;

  // Dynamic state tracking
  private currentWeatherType: WeatherType = 'CLEAR_FROST';
  private currentWindSpeed: number = 3.5;
  private targetMasterVolume: number = 0.045;
  private gustIntervalId: number | null = null;

  private initialized: boolean = false;
  private lastFootstepTime: number = 0;

  public init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;
      this.startAmbientWind();
    } catch (e) {
      console.warn("AudioContext could not be initialized:", e);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.windMasterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.windMasterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.targetMasterVolume,
        now,
        0.25
      );
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private ensureContext() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Calculates sound synthesis targets for each weather condition and wind speed.
   */
  private getWeatherProfile(type: WeatherType, windSpeed: number): WeatherWindProfile {
    // Normalize wind speed (0 to 10 scale, clamp to 0.0 - 1.25)
    const s = Math.max(0, Math.min(1.25, windSpeed / 10));

    switch (type) {
      case 'CLEAR_FROST':
        // Crisp, crystalline Arctic stillness with high-pitched frosty shimmer
        return {
          masterVolume: 0.038 + s * 0.018,
          rumbleGain: 0.016 + s * 0.012,
          rumbleFreq: 115,
          howlGain: 0.018 + s * 0.02,
          howlFreq: 330 + s * 70,
          howlQ: 2.6,
          shimmerGain: 0.024 + s * 0.022,
          shimmerFreq: 2600,
          auroraGain: 0.0,
          stormGain: 0.0,
          gustPeriodMs: 4000
        };

      case 'LIGHT_SNOW':
        // Serene, soft whispered air flow with gentle white noise dampening
        return {
          masterVolume: 0.032 + s * 0.014,
          rumbleGain: 0.012 + s * 0.01,
          rumbleFreq: 105,
          howlGain: 0.014 + s * 0.012,
          howlFreq: 270,
          howlQ: 1.9,
          shimmerGain: 0.012 + s * 0.008,
          shimmerFreq: 1800,
          auroraGain: 0.0,
          stormGain: 0.0,
          gustPeriodMs: 5000
        };

      case 'HEAVY_SNOWFALL':
        // Acoustic snow dampening: dense snowfall absorbs high frequencies, heavy sub-rumble
        return {
          masterVolume: 0.036 + s * 0.018,
          rumbleGain: 0.034 + s * 0.022,
          rumbleFreq: 90,
          howlGain: 0.009 + s * 0.01,
          howlFreq: 210,
          howlQ: 1.5,
          shimmerGain: 0.003, // Strongly muffled high end
          shimmerFreq: 950,
          auroraGain: 0.0,
          stormGain: 0.0,
          gustPeriodMs: 4400
        };

      case 'BLIZZARD':
        // Violent howling gale, piercing resonance, deafening sub-bass wind thrust & ice spray
        return {
          masterVolume: 0.075 + s * 0.035,
          rumbleGain: 0.065 + s * 0.045,
          rumbleFreq: 185,
          howlGain: 0.075 + s * 0.055,
          howlFreq: 540 + s * 140,
          howlQ: 6.2, // Piercing high-Q resonance whistling through trees & wires
          shimmerGain: 0.055 + s * 0.04,
          shimmerFreq: 3200,
          auroraGain: 0.0,
          stormGain: 0.008,
          gustPeriodMs: 1800 // Rapid, violent gust cycles
        };

      case 'EXTREME_COLD':
        // Razor-sharp dry frost whistle, low freezing drone, sudden biting gusts
        return {
          masterVolume: 0.046 + s * 0.02,
          rumbleGain: 0.022 + s * 0.015,
          rumbleFreq: 100,
          howlGain: 0.04 + s * 0.025,
          howlFreq: 470 + s * 60,
          howlQ: 4.4,
          shimmerGain: 0.036 + s * 0.02,
          shimmerFreq: 3400,
          auroraGain: 0.004,
          stormGain: 0.0,
          gustPeriodMs: 3600
        };

      case 'ANOMALOUS_AURORA':
        // Ionized atmosphere: ethereal singing overtone resonance drone blended into the wind
        return {
          masterVolume: 0.052 + s * 0.02,
          rumbleGain: 0.018 + s * 0.012,
          rumbleFreq: 110,
          howlGain: 0.026 + s * 0.02,
          howlFreq: 360,
          howlQ: 3.2,
          shimmerGain: 0.028 + s * 0.015,
          shimmerFreq: 2500,
          auroraGain: 0.05, // Audibly prominent harmonic drone
          stormGain: 0.003,
          gustPeriodMs: 4200
        };

      case 'MAGNETIC_STORM':
        // Turbulent fluctuating gusts, erratic ion static crackle and magnetic disturbance
        return {
          masterVolume: 0.062 + s * 0.03,
          rumbleGain: 0.042 + s * 0.025,
          rumbleFreq: 145,
          howlGain: 0.048 + s * 0.03,
          howlFreq: 430 + s * 80,
          howlQ: 4.8,
          shimmerGain: 0.034 + s * 0.02,
          shimmerFreq: 2100,
          auroraGain: 0.022,
          stormGain: 0.038, // Noticeable electrostatic noise layer
          gustPeriodMs: 2400
        };

      default:
        return {
          masterVolume: 0.04,
          rumbleGain: 0.02,
          rumbleFreq: 120,
          howlGain: 0.02,
          howlFreq: 320,
          howlQ: 2.5,
          shimmerGain: 0.02,
          shimmerFreq: 2000,
          auroraGain: 0.0,
          stormGain: 0.0,
          gustPeriodMs: 3500
        };
    }
  }

  // Multi-layer procedural ambient wind synthesizer
  private startAmbientWind() {
    if (!this.ctx || this.windMasterGain) return;
    try {
      // 1. Master wind gain node
      this.windMasterGain = this.ctx.createGain();
      this.windGain = this.windMasterGain;
      this.windMasterGain.gain.setValueAtTime(this.isMuted ? 0 : this.targetMasterVolume, this.ctx.currentTime);
      this.windMasterGain.connect(this.ctx.destination);

      // 2. Continuous stereo pink-tinted noise buffer (organic, warm, non-repetitive)
      const sampleRate = this.ctx.sampleRate;
      const bufferLength = sampleRate * 4; // 4 seconds looped
      const noiseBuffer = this.ctx.createBuffer(2, bufferLength, sampleRate);
      const leftChannel = noiseBuffer.getChannelData(0);
      const rightChannel = noiseBuffer.getChannelData(1);

      let b0_l = 0, b1_l = 0, b2_l = 0;
      let b0_r = 0, b1_r = 0, b2_r = 0;

      for (let i = 0; i < bufferLength; i++) {
        // Left channel pink noise approximation
        const wl = Math.random() * 2 - 1;
        b0_l = 0.99886 * b0_l + wl * 0.0555179;
        b1_l = 0.99332 * b1_l + wl * 0.0750759;
        b2_l = 0.96900 * b2_l + wl * 0.1538520;
        leftChannel[i] = (b0_l + b1_l + b2_l + wl * 0.5362) * 0.12;

        // Right channel decorrelated pink noise
        const wr = Math.random() * 2 - 1;
        b0_r = 0.99886 * b0_r + wr * 0.0555179;
        b1_r = 0.99332 * b1_r + wr * 0.0750759;
        b2_r = 0.96900 * b2_r + wr * 0.1538520;
        rightChannel[i] = (b0_r + b1_r + b2_r + wr * 0.5362) * 0.12;
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      // 3. LAYER 1: Deep low-frequency air body / sub-bass rumble
      this.windRumbleFilter = this.ctx.createBiquadFilter();
      this.windRumbleFilter.type = 'lowpass';
      this.windRumbleFilter.frequency.value = 115;
      this.windRumbleFilter.Q.value = 1.1;

      this.windRumbleGain = this.ctx.createGain();
      this.windRumbleGain.gain.value = 0.02;

      noiseSource.connect(this.windRumbleFilter);
      this.windRumbleFilter.connect(this.windRumbleGain);
      this.windRumbleGain.connect(this.windMasterGain);

      // 4. LAYER 2: Resonant howling gusts / whistle
      this.windHowlFilter = this.ctx.createBiquadFilter();
      this.windFilter = this.windHowlFilter;
      this.windHowlFilter.type = 'bandpass';
      this.windHowlFilter.frequency.value = 330;
      this.windHowlFilter.Q.value = 2.8;

      this.windHowlGain = this.ctx.createGain();
      this.windHowlGain.gain.value = 0.022;

      noiseSource.connect(this.windHowlFilter);
      this.windHowlFilter.connect(this.windHowlGain);
      this.windHowlGain.connect(this.windMasterGain);

      // 5. LAYER 3: High-frequency frost shimmer / biting ice crystal hiss
      this.windShimmerFilter = this.ctx.createBiquadFilter();
      this.windShimmerFilter.type = 'bandpass';
      this.windShimmerFilter.frequency.value = 2600;
      this.windShimmerFilter.Q.value = 1.6;

      this.windShimmerGain = this.ctx.createGain();
      this.windShimmerGain.gain.value = 0.025;

      noiseSource.connect(this.windShimmerFilter);
      this.windShimmerFilter.connect(this.windShimmerGain);
      this.windShimmerGain.connect(this.windMasterGain);

      // 6. LAYER 4: Ethereal Aurora harmonic drone (sine + triangle fifths)
      const auroraOsc1 = this.ctx.createOscillator();
      const auroraOsc2 = this.ctx.createOscillator();
      auroraOsc1.type = 'sine';
      auroraOsc1.frequency.value = 110; // A2
      auroraOsc2.type = 'triangle';
      auroraOsc2.frequency.value = 165.2; // E3 slightly detuned

      this.windAuroraFilter = this.ctx.createBiquadFilter();
      this.windAuroraFilter.type = 'bandpass';
      this.windAuroraFilter.frequency.value = 440;
      this.windAuroraFilter.Q.value = 3.5;

      this.windAuroraGain = this.ctx.createGain();
      this.windAuroraGain.gain.value = 0.0; // Fades in only during anomalous weather

      auroraOsc1.connect(this.windAuroraFilter);
      auroraOsc2.connect(this.windAuroraFilter);
      this.windAuroraFilter.connect(this.windAuroraGain);
      this.windAuroraGain.connect(this.windMasterGain);

      auroraOsc1.start(0);
      auroraOsc2.start(0);

      // 7. LAYER 5: Geomagnetic storm static & electrical turbulence flutter
      this.windStormFilter = this.ctx.createBiquadFilter();
      this.windStormFilter.type = 'bandpass';
      this.windStormFilter.frequency.value = 2300;
      this.windStormFilter.Q.value = 7.5;

      this.windStormGain = this.ctx.createGain();
      this.windStormGain.gain.value = 0.0;

      noiseSource.connect(this.windStormFilter);
      this.windStormFilter.connect(this.windStormGain);
      this.windStormGain.connect(this.windMasterGain);

      // Start the looped noise generator
      noiseSource.start(0);

      // Start organic gust breathing/modulation
      this.startGustModulation();

      // Apply initial weather profile
      this.updateWeatherWind(this.currentWeatherType, this.currentWindSpeed);
    } catch {
      // ignore audio context restrictions
    }
  }

  /**
   * Continuous organic gust modulation loop that simulates wind breathing and gusts.
   */
  private startGustModulation() {
    if (this.gustIntervalId) {
      clearInterval(this.gustIntervalId);
    }

    const modulate = () => {
      if (!this.ctx || !this.windHowlFilter || !this.windHowlGain) return;
      const now = this.ctx.currentTime;
      const s = Math.min(Math.max(this.currentWindSpeed / 10, 0.1), 1.25);

      let baseCenter = 320;
      let sweepRange = 160;
      let gustSwell = 0.018;

      if (this.currentWeatherType === 'BLIZZARD') {
        baseCenter = 480 + s * 160;
        sweepRange = 260 + s * 140;
        gustSwell = 0.04 + s * 0.045;
      } else if (this.currentWeatherType === 'EXTREME_COLD') {
        baseCenter = 440 + s * 60;
        sweepRange = 180;
        gustSwell = 0.025 + s * 0.02;
      } else if (this.currentWeatherType === 'HEAVY_SNOWFALL') {
        baseCenter = 210;
        sweepRange = 70;
        gustSwell = 0.008;
      } else if (this.currentWeatherType === 'MAGNETIC_STORM') {
        baseCenter = 390 + (Math.random() * 2 - 1) * 80;
        sweepRange = 230;
        gustSwell = 0.03 + s * 0.035;
      } else {
        baseCenter = 290 + s * 60;
        sweepRange = 140;
        gustSwell = 0.016 + s * 0.015;
      }

      const targetFreq = Math.max(120, baseCenter + (Math.random() * 2 - 1) * sweepRange);
      const modDuration = 1.2 + Math.random() * (3.0 - s * 1.5);

      this.windHowlFilter.frequency.setTargetAtTime(targetFreq, now, modDuration * 0.5);

      if (!this.isMuted) {
        const baseHowl = this.getWeatherProfile(this.currentWeatherType, this.currentWindSpeed).howlGain;
        const targetAmp = baseHowl + Math.random() * gustSwell;
        this.windHowlGain.gain.setTargetAtTime(targetAmp, now, modDuration * 0.4);
      }
    };

    this.gustIntervalId = window.setInterval(modulate, 2200);
  }

  /**
   * Smoothly crossfades the procedural background wind loop based on weather.type and weather.windSpeed.
   * Uses exponential ramps for seamless, artifact-free transitions between weather environments.
   */
  public updateWeatherWind(
    weatherOrType: { type: WeatherType; windSpeed: number } | WeatherType,
    windSpeedParam?: number
  ) {
    this.ensureContext();
    if (!this.ctx) return;

    let type: WeatherType;
    let speed: number;

    if (typeof weatherOrType === 'object' && weatherOrType !== null) {
      type = weatherOrType.type;
      speed = weatherOrType.windSpeed;
    } else {
      type = weatherOrType;
      speed = windSpeedParam ?? 3.5;
    }

    this.currentWeatherType = type;
    this.currentWindSpeed = speed;

    if (!this.windMasterGain) {
      this.startAmbientWind();
    }
    if (!this.windMasterGain) return;

    const profile = this.getWeatherProfile(type, speed);
    this.targetMasterVolume = profile.masterVolume;

    const now = this.ctx.currentTime;
    // Crossfade time constant for a smooth ~2.5 - 3.0 second exponential crossfade
    const crossfadeTimeConstant = 1.8;

    // Master volume crossfade
    if (!this.isMuted) {
      this.windMasterGain.gain.setTargetAtTime(profile.masterVolume, now, crossfadeTimeConstant);
    }

    // Crossfade Layer 1: Sub-bass air body & rumble
    if (this.windRumbleGain && this.windRumbleFilter) {
      this.windRumbleGain.gain.setTargetAtTime(profile.rumbleGain, now, crossfadeTimeConstant);
      this.windRumbleFilter.frequency.setTargetAtTime(profile.rumbleFreq, now, crossfadeTimeConstant);
    }

    // Crossfade Layer 2: Resonant howling gusts & whistle
    if (this.windHowlGain && this.windHowlFilter) {
      this.windHowlGain.gain.setTargetAtTime(profile.howlGain, now, crossfadeTimeConstant);
      this.windHowlFilter.frequency.setTargetAtTime(profile.howlFreq, now, crossfadeTimeConstant);
      this.windHowlFilter.Q.setTargetAtTime(profile.howlQ, now, crossfadeTimeConstant);
    }

    // Crossfade Layer 3: High-frequency frost shimmer / ice crystals
    if (this.windShimmerGain && this.windShimmerFilter) {
      this.windShimmerGain.gain.setTargetAtTime(profile.shimmerGain, now, crossfadeTimeConstant);
      this.windShimmerFilter.frequency.setTargetAtTime(profile.shimmerFreq, now, crossfadeTimeConstant);
    }

    // Crossfade Layer 4: Aurora harmonic overtone
    if (this.windAuroraGain) {
      this.windAuroraGain.gain.setTargetAtTime(profile.auroraGain, now, crossfadeTimeConstant);
    }

    // Crossfade Layer 5: Geomagnetic static crackle
    if (this.windStormGain) {
      this.windStormGain.gain.setTargetAtTime(profile.stormGain, now, crossfadeTimeConstant);
    }
  }

  public setWindIntensity(intensity: number) {
    const scaledSpeed = Math.max(0.5, Math.min(10, intensity * 10));
    this.updateWeatherWind(this.currentWeatherType, scaledSpeed);
  }

  // Snow footstep crunch
  public playFootstep(isDeepSnow: boolean = false) {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;
    const now = Date.now();
    if (now - this.lastFootstepTime < 180) return;
    this.lastFootstepTime = now;

    try {
      const duration = isDeepSnow ? 0.16 : 0.09;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = isDeepSnow ? 'lowpass' : 'bandpass';
      filter.frequency.value = isDeepSnow ? 450 : 1800;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(isDeepSnow ? 0.22 : 0.14, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
    } catch {
      // ignore
    }
  }

  // "Эхо-4" Odradek Scanner Pulse (electromagnetic sonar chirp)
  public playScannerPing() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      const now = this.ctx.currentTime;
      osc1.frequency.setValueAtTime(440, now);
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.25);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.4);

      osc2.frequency.setValueAtTime(220, now);
      osc2.frequency.exponentialRampToValueAtTime(660, now + 0.35);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.6);
      osc2.stop(now + 0.6);
    } catch {
      // ignore
    }
  }

  // Geiger click / Anomaly proximity tick
  public playAnomalyTick(intensity: number = 0.5) {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(2200 + Math.random() * 800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);

      gain.gain.setValueAtTime(0.08 * intensity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // ignore
    }
  }

  // Heartbeat when holding breath
  public playHeartbeat() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const playThump = (time: number, freq: number, vol: number) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.12);

        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 0.16);
      };

      playThump(now, 75, 0.3);
      playThump(now + 0.15, 60, 0.2);
    } catch {
      // ignore
    }
  }

  // Balance stumble warning / cargo rattling
  public playStumbleWarning() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.linearRampToValueAtTime(90, now + 0.18);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // ignore
    }
  }

  // Fall & Cargo drop impact
  public playCargoImpact() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      // Metal container clatter
      [240, 480, 720].forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.04);
        gain.gain.setValueAtTime(0.2, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.04);
        osc.stop(now + i * 0.04 + 0.18);
      });
    } catch {
      // ignore
    }
  }

  // Successful Delivery Fanfare (atmospheric melodic arpeggio)
  public playDeliverySuccess() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C, E, G, C5, E5
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.65);
      });
    } catch {
      // ignore
    }
  }

  // Sip of hot tea from thermos
  public playThermosSip() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.2);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.28);
    } catch {
      // ignore
    }
  }

  // Ladder or rope deployed
  public playToolDeploy() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(440, now + 0.15);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // ignore
    }
  }

  // Crafting assembly sound (mechanical clinking & ratchet)
  public playCraftSuccess() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      [330, 495, 660, 880].forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.2);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.22);
      });
    } catch {
      // ignore
    }
  }

  // Gathering/Harvesting resource rustle
  public playHarvest() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.12);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // ignore
    }
  }

  // Barter / Trade transaction chime
  public playTradeSuccess() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.14, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.27);
      });
    } catch {
      // ignore
    }
  }

  // Quest received radio burst
  public playQuestAccept() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch {
      // ignore
    }
  }

  // Quest completed reward fanfare
  public playQuestComplete() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      [392.0, 523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.15, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.4);
      });
    } catch {
      // ignore
    }
  }

  // Signal flare ignition hiss
  public playFlareIgnite() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(200, now + 0.4);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch {
      // ignore
    }
  }

  // Lore discovery / Region explored chime
  public playDiscoveryChime() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } catch {
      // ignore
    }
  }

  // Tactical menu tab / button select click
  public playMenuSelect() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // ignore
    }
  }

  // Geiger / tape playback anomaly static click
  public playGeigerClick(volume = 0.5) {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1200 + Math.random() * 800, now);
      const targetVol = Math.max(0.01, Math.min(0.2, volume * 0.1));
      gain.gain.setValueAtTime(targetVol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.02);
    } catch {
      // ignore
    }
  }
}

export const sound = new SoundSystem();
