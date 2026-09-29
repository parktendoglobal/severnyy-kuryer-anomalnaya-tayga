/*
 * ЗВУК ИГРЫ «Северный Курьер».
 * Все звуки игры синтезируются прямо в браузере (Web Audio API) из генераторов тона
 * (осцилляторов) и «шума» — никаких звуковых файлов в проекте нет. Поэтому любой звук
 * настраивается числами: частота (Гц — чем больше, тем выше звук), длительность (секунды)
 * и громкость (от 0 = тишина до 1 = максимум; в игре почти всё тише 0.3).
 * Браузер разрешает включать звук только после первого касания/клика игрока — для этого
 * есть метод init(), который игра вызывает по первому действию.
 * Группы звуков: фоновый ветер, меняющийся по погоде; шаги по снегу; сканер «Эхо-4»;
 * аномалии (щелчки счётчика Гейгера, сердцебиение); интерфейс, квесты, торговля и крафт.
 * Снаружи используется один общий объект `sound` (в самом конце файла).
 */
import { WeatherType } from '../types/game';

// Настройки фонового ветра для одной погоды. Ветер собран из 5 «слоёв», у каждого своя
// громкость (…Gain, 0–1) и высота (…Freq, Гц):
//  rumble  — низкий гул воздуха (90–185 Гц);
//  howl    — завывание/свист (200–700 Гц); howlQ — «узость» свиста: чем больше, тем
//            звонче и пронзительнее (1.5 = мягкий шорох, 6 = свист в проводах);
//  shimmer — высокое шипение ледяной крошки (950–3400 Гц);
//  aurora  — тихий «поющий» аккорд, звучит только при аномальной погоде;
//  storm   — электрический треск магнитной бури.
// masterVolume — общая громкость ветра; gustPeriodMs — задуманный период порывов в мс
// (сейчас код его не читает: порывы на деле идут каждые 2.2 с, см. startGustModulation).
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

// Звуковая система игры. Хранит единственный аудио-контекст браузера и узлы фонового ветра;
// каждый метод play…() создаёт короткий одноразовый звук и сразу его проигрывает.
class SoundSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  // Общий регулятор громкости ветра (и два старых псевдонима для совместимости)
  private windMasterGain: GainNode | null = null;
  private windGain: GainNode | null = null; // Alias for backward compatibility
  private windFilter: BiquadFilterNode | null = null; // Alias for backward compatibility

  // Отдельные слои ветра: у каждого свой фильтр (какую полосу частот пропускать) и громкость,
  // чтобы при смене погоды плавно перетекать от одного звучания к другому
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

  // Текущее состояние: погода, сила ветра (шкала 0–10, по умолчанию 3.5 — лёгкий ветер),
  // целевая громкость ветра (0.045 ≈ 4.5% от максимума — тихий фон) и таймер порывов
  private currentWeatherType: WeatherType = 'CLEAR_FROST';
  private currentWindSpeed: number = 3.5;
  private targetMasterVolume: number = 0.045;
  private gustIntervalId: number | null = null;

  private initialized: boolean = false;
  // Время последнего шага (мс) — чтобы шаги не звучали чаще, чем раз в 180 мс
  private lastFootstepTime: number = 0;

  // Запуск звука. Браузер разрешает звук только после первого касания/клика игрока,
  // поэтому игра вызывает init() по первому действию. Сразу же включается фоновый ветер.
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

  // Вкл/выкл звук (кнопка «без звука»). Ветер затихает или возвращается плавно,
  // примерно за полсекунды (0.25 — постоянная времени затухания в секундах).
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

  // Служебная проверка перед каждым звуком: если звук ещё не запущен — запускаем;
  // если браузер «усыпил» звук (например, вкладка была свёрнута) — будим.
  private ensureContext() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Подбирает настройки ветра (см. WeatherWindProfile) под погоду и силу ветра.
   * Многие значения записаны как «база + s × добавка»: чем сильнее ветер, тем громче и выше.
   */
  private getWeatherProfile(type: WeatherType, windSpeed: number): WeatherWindProfile {
    // s — сила ветра, пересчитанная из шкалы 0–10 в 0–1.25 (ветер 10 → 1.0, максимум 12.5 → 1.25)
    const s = Math.max(0, Math.min(1.25, windSpeed / 10));

    switch (type) {
      case 'CLEAR_FROST':
        // Ясный мороз: тихо и прозрачно, лёгкий свист ~330–400 Гц и звонкое ледяное шипение 2600 Гц
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
        // Лёгкий снег: мягкий шёпот ветра, всё тише и ниже, чем в ясную погоду
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
        // Сильный снегопад: снег «глушит» высокие звуки — почти нет шипения (0.003), зато слышен низкий гул 90 Гц
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
        // Буран: самый громкий режим (общая громкость до ~0.12 — в 2–3 раза громче ясной погоды),
        // пронзительный свист 540–720 Гц (Q 6.2) и немного треска
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
        // Сильный мороз: сухой режущий свист ~470–530 Гц, очень высокое шипение 3400 Гц, еле слышный аккорд
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
        // Аномальное сияние: к ветру добавляется заметный «поющий» аккорд (0.05) — неземное гудение
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
        // Магнитная буря: неровный свист, слышимый электрический треск (0.038) и немного аккорда
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

      // На случай неизвестной погоды — средние, нейтральные значения
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

  // Собирает фоновый ветер: один бесконечно зацикленный «шум» пропускается через 5 фильтров-слоёв
  // (гул, завывание, шипение, треск) плюс два тона для аномального аккорда. Всё сводится в общую громкость.
  private startAmbientWind() {
    if (!this.ctx || this.windMasterGain) return;
    try {
      // 1. Общая громкость ветра
      this.windMasterGain = this.ctx.createGain();
      this.windGain = this.windMasterGain;
      this.windMasterGain.gain.setValueAtTime(this.isMuted ? 0 : this.targetMasterVolume, this.ctx.currentTime);
      this.windMasterGain.connect(this.ctx.destination);

      // 2. Готовим 4 секунды стерео-«шума», которые крутятся по кругу. Это «розовый» шум — мягче и теплее обычного белого, похож на ветер
      const sampleRate = this.ctx.sampleRate;
      const bufferLength = sampleRate * 4; // 4 seconds looped
      const noiseBuffer = this.ctx.createBuffer(2, bufferLength, sampleRate);
      const leftChannel = noiseBuffer.getChannelData(0);
      const rightChannel = noiseBuffer.getChannelData(1);

      let b0_l = 0, b1_l = 0, b2_l = 0;
      let b0_r = 0, b1_r = 0, b2_r = 0;

      for (let i = 0; i < bufferLength; i++) {
        // Левый канал. Магические коэффициенты (0.99886, 0.0555179 и т.п.) — стандартный рецепт превращения
        // белого шума в розовый; 0.12 — итоговое уменьшение громкости, чтобы не было перегруза
        const wl = Math.random() * 2 - 1;
        b0_l = 0.99886 * b0_l + wl * 0.0555179;
        b1_l = 0.99332 * b1_l + wl * 0.0750759;
        b2_l = 0.96900 * b2_l + wl * 0.1538520;
        leftChannel[i] = (b0_l + b1_l + b2_l + wl * 0.5362) * 0.12;

        // Правый канал — такой же шум, но свой, независимый: так ветер звучит объёмно, «вокруг» игрока
        const wr = Math.random() * 2 - 1;
        b0_r = 0.99886 * b0_r + wr * 0.0555179;
        b1_r = 0.99332 * b1_r + wr * 0.0750759;
        b2_r = 0.96900 * b2_r + wr * 0.1538520;
        rightChannel[i] = (b0_r + b1_r + b2_r + wr * 0.5362) * 0.12;
      }

      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      // 3. СЛОЙ 1: низкий гул воздуха — пропускаем только частоты ниже 115 Гц (глухой гул)
      this.windRumbleFilter = this.ctx.createBiquadFilter();
      this.windRumbleFilter.type = 'lowpass';
      this.windRumbleFilter.frequency.value = 115;
      this.windRumbleFilter.Q.value = 1.1;

      this.windRumbleGain = this.ctx.createGain();
      this.windRumbleGain.gain.value = 0.02;

      noiseSource.connect(this.windRumbleFilter);
      this.windRumbleFilter.connect(this.windRumbleGain);
      this.windRumbleGain.connect(this.windMasterGain);

      // 4. СЛОЙ 2: завывание/свист — узкая полоса вокруг 330 Гц (при смене погоды высота меняется)
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

      // 5. СЛОЙ 3: ледяное шипение — высокая полоса вокруг 2600 Гц
      this.windShimmerFilter = this.ctx.createBiquadFilter();
      this.windShimmerFilter.type = 'bandpass';
      this.windShimmerFilter.frequency.value = 2600;
      this.windShimmerFilter.Q.value = 1.6;

      this.windShimmerGain = this.ctx.createGain();
      this.windShimmerGain.gain.value = 0.025;

      noiseSource.connect(this.windShimmerFilter);
      this.windShimmerFilter.connect(this.windShimmerGain);
      this.windShimmerGain.connect(this.windMasterGain);

      // 6. СЛОЙ 4: «поющий» аккорд сияния — два тона: 110 Гц (нота Ля) и 165.2 Гц (Ми, чуть расстроенная — для «живого» биения)
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
      // Изначально выключен (0) — включается только при аномальной погоде
      this.windAuroraGain.gain.value = 0.0; // Fades in only during anomalous weather

      auroraOsc1.connect(this.windAuroraFilter);
      auroraOsc2.connect(this.windAuroraFilter);
      this.windAuroraFilter.connect(this.windAuroraGain);
      this.windAuroraGain.connect(this.windMasterGain);

      auroraOsc1.start(0);
      auroraOsc2.start(0);

      // 7. СЛОЙ 5: треск магнитной бури — очень узкая полоса около 2300 Гц (Q 7.5) даёт электрическое потрескивание
      this.windStormFilter = this.ctx.createBiquadFilter();
      this.windStormFilter.type = 'bandpass';
      this.windStormFilter.frequency.value = 2300;
      this.windStormFilter.Q.value = 7.5;

      this.windStormGain = this.ctx.createGain();
      this.windStormGain.gain.value = 0.0;

      noiseSource.connect(this.windStormFilter);
      this.windStormFilter.connect(this.windStormGain);
      this.windStormGain.connect(this.windMasterGain);

      // Запускаем зацикленный шум
      noiseSource.start(0);

      // Запускаем случайные порывы ветра
      this.startGustModulation();

      // Сразу настраиваем звучание под текущую погоду
      this.updateWeatherWind(this.currentWeatherType, this.currentWindSpeed);
    } catch {
      // браузер может запретить звук — тогда просто играем без ветра
    }
  }

  /**
   * Порывы ветра: каждые 2.2 секунды случайно сдвигает высоту и громкость завывания,
   * чтобы ветер «дышал» и не звучал как ровный монотонный шум.
   */
  private startGustModulation() {
    if (this.gustIntervalId) {
      clearInterval(this.gustIntervalId);
    }

    const modulate = () => {
      if (!this.ctx || !this.windHowlFilter || !this.windHowlGain) return;
      const now = this.ctx.currentTime;
      const s = Math.min(Math.max(this.currentWindSpeed / 10, 0.1), 1.25);

      // Настройки порывов: baseCenter — средняя высота свиста (Гц), sweepRange — насколько
      // случайно она может уйти вверх/вниз (Гц), gustSwell — на сколько порыв добавляет громкости.
      // Ниже эти значения переопределяются под погоду: буран — выше и сильнее, снегопад — глуше,
      // магнитная буря — хаотичнее; для прочей погоды — умеренные значения.
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

      // Новая случайная высота свиста (не ниже 120 Гц) и длительность перехода: от 1.2 до ~4.2 с,
      // при сильном ветре переходы короче (ветер резче).
      const targetFreq = Math.max(120, baseCenter + (Math.random() * 2 - 1) * sweepRange);
      const modDuration = 1.2 + Math.random() * (3.0 - s * 1.5);

      this.windHowlFilter.frequency.setTargetAtTime(targetFreq, now, modDuration * 0.5);

      // Громкость порыва = базовая громкость завывания + случайная прибавка до gustSwell
      if (!this.isMuted) {
        const baseHowl = this.getWeatherProfile(this.currentWeatherType, this.currentWindSpeed).howlGain;
        const targetAmp = baseHowl + Math.random() * gustSwell;
        this.windHowlGain.gain.setTargetAtTime(targetAmp, now, modDuration * 0.4);
      }
    };

    // Повторяем каждые 2200 мс (2.2 с)
    this.gustIntervalId = window.setInterval(modulate, 2200);
  }

  /**
   * Плавно меняет фоновый ветер под новую погоду и силу ветра. Вызывается игрой при смене погоды.
   * Можно передать объект погоды или отдельно тип погоды и силу ветра (по умолчанию 3.5).
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
    // Время плавного перехода: 1.8 — постоянная времени в секундах, полностью звук перестраивается примерно за 3–5 с
    const crossfadeTimeConstant = 1.8;

    // Общая громкость
    if (!this.isMuted) {
      this.windMasterGain.gain.setTargetAtTime(profile.masterVolume, now, crossfadeTimeConstant);
    }

    // Слой 1: низкий гул
    if (this.windRumbleGain && this.windRumbleFilter) {
      this.windRumbleGain.gain.setTargetAtTime(profile.rumbleGain, now, crossfadeTimeConstant);
      this.windRumbleFilter.frequency.setTargetAtTime(profile.rumbleFreq, now, crossfadeTimeConstant);
    }

    // Слой 2: завывание/свист (громкость, высота и «пронзительность»)
    if (this.windHowlGain && this.windHowlFilter) {
      this.windHowlGain.gain.setTargetAtTime(profile.howlGain, now, crossfadeTimeConstant);
      this.windHowlFilter.frequency.setTargetAtTime(profile.howlFreq, now, crossfadeTimeConstant);
      this.windHowlFilter.Q.setTargetAtTime(profile.howlQ, now, crossfadeTimeConstant);
    }

    // Слой 3: ледяное шипение
    if (this.windShimmerGain && this.windShimmerFilter) {
      this.windShimmerGain.gain.setTargetAtTime(profile.shimmerGain, now, crossfadeTimeConstant);
      this.windShimmerFilter.frequency.setTargetAtTime(profile.shimmerFreq, now, crossfadeTimeConstant);
    }

    // Слой 4: «поющий» аккорд сияния
    if (this.windAuroraGain) {
      this.windAuroraGain.gain.setTargetAtTime(profile.auroraGain, now, crossfadeTimeConstant);
    }

    // Слой 5: электрический треск
    if (this.windStormGain) {
      this.windStormGain.gain.setTargetAtTime(profile.stormGain, now, crossfadeTimeConstant);
    }
  }

  // Задать силу ветра числом 0–1 (переводится в шкалу 0.5–10), погода остаётся прежней
  public setWindIntensity(intensity: number) {
    const scaledSpeed = Math.max(0.5, Math.min(10, intensity * 10));
    this.updateWeatherWind(this.currentWeatherType, scaledSpeed);
  }

  // Хруст шага по снегу. Звучит при ходьбе, не чаще раза в 180 мс.
  // Короткий затухающий шум: по обычному снегу — 0.09 с, звонкий хруст около 1800 Гц, громкость 0.14;
  // по глубокому снегу — 0.16 с, глухой (только ниже 450 Гц) и чуть громче (0.22).
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Импульс сканера «Эхо-4»: электронный «пинг» как у сонара. Два тона взлетают вверх
  // (440 → 1320 → 880 Гц и 220 → 660 Гц), громкость 0.18 гаснет за ~0.55 с.
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Тиканье рядом с аномалией (как счётчик Гейгера). Очень короткий щелчок — 0.04 с,
  // высокий тон 2200–3000 Гц (случайно), быстро падающий до 300 Гц. Громкость 0.08 × intensity (0–1):
  // чем ближе аномалия, тем громче щелчки.
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Сердцебиение, когда игрок задерживает дыхание. Два глухих удара «тук-тук» с паузой 0.15 с:
  // первый 75 Гц (громкость 0.3), второй тише — 60 Гц (0.2); каждый уходит вниз до 30 Гц за ~0.14 с.
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Предупреждение о потере равновесия / дребезг груза. Резкий «зудящий» тон,
  // сползающий с 160 до 90 Гц за 0.18 с, громкость 0.15.
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Падение игрока и удар груза о землю
  public playCargoImpact() {
    this.ensureContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      // Лязг металлического контейнера: три удара 240, 480 и 720 Гц с интервалом 0.04 с, каждый гаснет за 0.15 с
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Успешная доставка груза: светлое арпеджио из 5 нот (До-Ми-Соль-До-Ми, 262–659 Гц),
  // ноты идут через 0.12 с, каждая мягко нарастает за 0.03 с и звучит ~0.6 с.
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Глоток горячего чая из термоса: мягкий тон, скользящий вверх 320 → 640 Гц за 0.2 с («буль»), громкость 0.12
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Лестница или верёвка установлена: короткий «механический» тон 180 → 440 Гц за 0.15 с, громкость 0.12
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Успешный крафт (сборка предмета): 4 быстрых металлических «дзынь» 330–880 Гц через 0.08 с
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Сбор ресурсов: короткий шорох, тон 140 → 520 Гц за 0.12 с, громкость 0.1
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Успешный обмен/торговля: звонкий колокольчик из 3 нот (До-Ми-Соль верхней октавы, 523–784 Гц) через 0.07 с
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Получен квест: короткий радиосигнал «пи-пи» — 440 Гц, через 0.08 с скачок на октаву вверх (880 Гц)
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Квест выполнен: победная фанфара из 5 восходящих нот (392–1046 Гц) через 0.1 с, каждая звучит ~0.35 с
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Зажигание сигнальной ракеты: шипящий тон, падающий 800 → 200 Гц за 0.4 с, громкость 0.18
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Открытие (найдена запись/исследован регион): колокольчик из 4 восходящих нот 523–1046 Гц через 0.08 с
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Щелчок меню/кнопки: очень короткий «тик» 880 → 440 Гц длиной 0.045 с, тихий (0.08)
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }

  // Треск аномалии при прослушивании записей (щелчок Гейгера). Сверхкороткий щелчок 0.015 с,
  // тон 1200–2000 Гц (случайно). Громкость = volume × 0.1, но в пределах 0.01–0.2.
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
      // звук не критичен — если браузер выдал ошибку, просто молчим
    }
  }
}

// Единственный общий экземпляр звуковой системы — его импортируют остальные части игры
export const sound = new SoundSystem();
