import { env } from '@/shared/config/env';

declare global {
  interface Window {
    ymaps?: any;
  }
}

/**
 * Загрузить Яндекс API (если ещё не загружен)
 * Используется для пересчёта расстояния при синхронизации
 */
export async function loadYandexApi(): Promise<void> {
  // Если API уже загружен и multiRouter доступен
  if (window.ymaps && window.ymaps.multiRouter?.MultiRoute) {
    return new Promise((resolve) => {
      window.ymaps.ready(() => resolve());
    });
  }

  const url = `https://api-maps.yandex.ru/2.1/?apikey=${env.yandexMapApiKey}&lang=ru_RU`;

  // Пробуем загрузить из кеша Service Worker
  try {
    const cache = await caches.open('yandex-maps-api');
    const cachedResponse = await cache.match(url);

    if (cachedResponse) {
      const scriptText = await cachedResponse.text();
      const script = document.createElement('script');
      script.textContent = scriptText;
      document.head.appendChild(script);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('ymaps ready timeout')), 15000);
        if (window.ymaps) {
          window.ymaps.ready(() => {
            clearTimeout(timeout);
            resolve();
          });
        } else {
          reject(new Error('ymaps not available from cache'));
        }
      });
    }
  } catch (e) {
    console.warn('[loadYandexApi] Cache read failed, trying network:', e);
  }

  // Если нет в кеше — грузим с сервера
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Yandex API: ${response.status}`);
  }

  const scriptText = await response.text();
  const script = document.createElement('script');
  script.textContent = scriptText;
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('ymaps ready timeout')), 15000);
    if (window.ymaps) {
      window.ymaps.ready(() => {
        clearTimeout(timeout);
        resolve();
      });
    } else {
      reject(new Error('ymaps not available from network'));
    }
  });
}