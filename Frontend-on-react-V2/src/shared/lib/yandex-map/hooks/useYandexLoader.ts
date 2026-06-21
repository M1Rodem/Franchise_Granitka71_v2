import { useEffect, useState } from 'react';
import { env } from '@/shared/config/env';

declare global {
  interface Window {
    ymaps?: any;
  }
}

let loaderPromise: Promise<void> | null = null;

async function loadApiViaFetch(): Promise<void> {
  const url = `https://api-maps.yandex.ru/2.1/?apikey=${env.yandexMapApiKey}&lang=ru_RU`;
  
  // Пробуем загрузить из кеша напрямую
  const cache = await caches.open('yandex-maps-api');
  const cachedResponse = await cache.match(url);
  
  if (cachedResponse) {
    const scriptText = await cachedResponse.text();
    const script = document.createElement('script');
    script.textContent = scriptText;
    document.head.appendChild(script);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('ymaps ready timeout')), 10000);
      if (window.ymaps) {
        window.ymaps.ready(() => {
          clearTimeout(timeout);
          resolve();
        });
      } else {
        reject(new Error('ymaps not available'));
      }
    });
  }
  
  // Если нет в кеше — грузим с сервера
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch API: ${response.status}`);
  const scriptText = await response.text();
  const script = document.createElement('script');
  script.textContent = scriptText;
  document.head.appendChild(script);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('ymaps ready timeout')), 10000);
    if (window.ymaps) {
      window.ymaps.ready(() => {
        clearTimeout(timeout);
        resolve();
      });
    } else {
      reject(new Error('ymaps not available'));
    }
  });
}

async function loadApiViaScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${env.yandexMapApiKey}&lang=ru_RU`;
    script.async = true;

    script.onload = () => {
      if (window.ymaps) {
        window.ymaps.ready(() => resolve());
      } else {
        reject(new Error('ymaps not available'));
      }
    };

    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export function useYandexLoader() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (window.ymaps) {
      setIsLoaded(true);
      return;
    }

    if (!env.yandexMapApiKey) {
      console.error('Yandex Map API key is missing');
      return;
    }

    if (!loaderPromise) {
      // Сначала пробуем через fetch (SW перехватит)
      loaderPromise = loadApiViaFetch()
        .then(() => {
          setIsLoaded(true);
        })
        .catch((error) => {
          console.warn('[YandexLoader] Fetch failed, trying script:', error);
          // Если fetch не сработал — пробуем через script
          return loadApiViaScript()
            .then(() => {
              setIsLoaded(true);
            })
            .catch((scriptError) => {
              console.error('[YandexLoader] Both methods failed:', scriptError);
              setIsLoaded(false);
            });
        });
    }

    loaderPromise.then(() => {
      if (window.ymaps) {
        setIsLoaded(true);
      }
    });
  }, []);

  return { isLoaded };
}