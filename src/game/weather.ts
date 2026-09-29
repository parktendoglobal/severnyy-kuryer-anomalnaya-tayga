/**
 * ПОГОДА
 *
 * Здесь описаны все виды погоды в тайге (мороз, снегопад, буран, полярное сияние…)
 * и правило, по которому погода меняется со временем. Сама погода влияет на игру
 * в других местах: скорость и замерзание курьера — в playerPhysics.ts, снег и туман
 * на экране — в TaigaRenderer.ts, вой ветра — в audio.ts.
 */
import { WeatherState, WeatherType } from '../types/game';

// Настройки одного вида погоды.
interface WeatherPreset {
  nameRu: string;
  temp: number; // температура воздуха, °C (показывается в интерфейсе)
  windSpeed: number; // сила ветра по шкале 0–10: раскачивает груз и гонит снежинки
  windX: number; // направление ветра по горизонтали (плюс — вправо, минус — влево)
  windY: number; // направление ветра по вертикали (плюс — вниз)
  visibility: number; // видимость от 0 (ничего не видно) до 1 (ясно)
  anomIntensity: number; // насколько возбуждены аномалии, от 0 до 1
  dangerLevel: WeatherState['dangerLevel'];
  description: string;
}

export const WEATHER_PRESETS: Record<WeatherType, WeatherPreset> = {
  CLEAR_FROST: {
    nameRu: 'Ясный мороз',
    temp: -22,
    windSpeed: 2.5,
    windX: 0.8,
    windY: 0.4,
    visibility: 0.95,
    anomIntensity: 0.15,
    dangerLevel: 'LOW',
    description: 'Чистое небо и морозный воздух. Стабильное сцепление.'
  },
  LIGHT_SNOW: {
    nameRu: 'Тихий снегопад',
    temp: -18,
    windSpeed: 3.0,
    windX: 0.5,
    windY: 1.0,
    visibility: 0.85,
    anomIntensity: 0.2,
    dangerLevel: 'LOW',
    description: 'Слабый снег, безопасные условия перемещения.'
  },
  BLIZZARD: {
    nameRu: 'Свирепый буран',
    temp: -34,
    windSpeed: 9.5,
    windX: 2.2,
    windY: 1.4,
    visibility: 0.35,
    anomIntensity: 0.45,
    dangerLevel: 'EXTREME',
    description: 'Шквальный ветер и нулевая видимость! Риск потери груза и замерзания.'
  },
  EXTREME_COLD: {
    nameRu: 'Аномальный мороз (-42°C)',
    temp: -42,
    windSpeed: 4.0,
    windX: 0.6,
    windY: 0.3,
    visibility: 0.8,
    anomIntensity: 0.6,
    dangerLevel: 'HIGH',
    description: 'Критическое падение температуры до -42°C. Ускоренная гипотермия.'
  },
  HEAVY_SNOWFALL: {
    nameRu: 'Глубокий снегопад',
    temp: -16,
    windSpeed: 2.0,
    windX: 0.3,
    windY: 1.8,
    visibility: 0.55,
    anomIntensity: 0.25,
    dangerLevel: 'MEDIUM',
    description: 'Сугробы по колено. Высокий износ обуви и расход выносливости.'
  },
  ANOMALOUS_AURORA: {
    nameRu: 'Полярное сияние (Аномалия)',
    temp: -24,
    windSpeed: 1.8,
    windX: 0.5,
    windY: 0.2,
    visibility: 0.9,
    anomIntensity: 0.85,
    dangerLevel: 'MEDIUM',
    description: 'Ионизация атмосферы. Радар Эхо-4 усиливается, аномалии возбуждены.'
  },
  MAGNETIC_STORM: {
    nameRu: 'Геомагнитная буря',
    temp: -20,
    windSpeed: 6.5,
    windX: -1.5,
    windY: 1.0,
    visibility: 0.65,
    anomIntensity: 0.95,
    dangerLevel: 'HIGH',
    description: 'Геомагнитные помехи. Сенсоры дают сбои, фантомы агрессивны.'
  }
};

// Погода в самом начале игры: ясный мороз с чуть более сильным ветром, чем обычно.
// Первая смена погоды наступит через 40 секунд.
export const INITIAL_WEATHER: WeatherState = {
  type: 'CLEAR_FROST',
  nameRu: 'Ясный мороз',
  windX: 1,
  windY: 0.5,
  windSpeed: 3.5,
  visibility: 0.95,
  anomalyIntensity: 0.2,
  tempCelsius: -22,
  timeToChange: 40,
  dangerLevel: 'LOW',
  description: 'Чистое небо и морозный воздух. Стабильное сцепление.'
};

/**
 * Продвинуть погоду на dt секунд вперёд.
 * Пока таймер timeToChange не истёк, погода та же (changed = false). Когда истёк —
 * выбирается случайная погода из всех семи (все равновероятны, может выпасть та же самая),
 * и следующая смена назначается через 45–85 секунд.
 */
export function tickWeather(prev: WeatherState, dt: number): { weather: WeatherState; changed: boolean } {
  if (prev.timeToChange > dt) {
    return { weather: { ...prev, timeToChange: prev.timeToChange - dt }, changed: false };
  }

  const allTypes = Object.keys(WEATHER_PRESETS) as WeatherType[];
  const nextType = allTypes[Math.floor(Math.random() * allTypes.length)];
  const preset = WEATHER_PRESETS[nextType];

  return {
    changed: true,
    weather: {
      ...prev,
      type: nextType,
      nameRu: preset.nameRu,
      tempCelsius: preset.temp,
      windSpeed: preset.windSpeed,
      windX: preset.windX,
      windY: preset.windY,
      visibility: preset.visibility,
      anomalyIntensity: preset.anomIntensity,
      dangerLevel: preset.dangerLevel,
      description: preset.description,
      timeToChange: 45 + Math.random() * 40
    }
  };
}
