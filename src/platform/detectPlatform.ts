import { PlatformId } from './types';

const PLATFORMS: PlatformId[] = ['standalone', 'telegram', 'vk', 'max'];

/**
 * Works out which host launched the game from the launch URL, before any SDK loads.
 * `?platform=telegram|vk|max|standalone` overrides detection (handy for testing).
 */
export function detectPlatform(): PlatformId {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));

  const forced = search.get('platform') as PlatformId | null;
  if (forced && PLATFORMS.includes(forced)) return forced;

  // Telegram passes launch params in the hash; the SDK may also already be present
  if (hash.has('tgWebAppData') || hash.has('tgWebAppPlatform') || window.Telegram?.WebApp?.initData) {
    return 'telegram';
  }
  // VK signs its launch params into the query string
  if (search.has('vk_app_id') && search.has('sign')) return 'vk';
  // MAX passes launch data in the hash as WebAppData
  if (hash.has('WebAppData') || window.WebApp?.initData) return 'max';

  return 'standalone';
}
